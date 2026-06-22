import cors from "cors";
import express from "express";
import crypto from "crypto";
import { pool, query } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const searchCache = new Map();
const CACHE_TTL_MS = 15_000;
const LIVE_REFRESH_MS = 3_000;
const HOLD_MINUTES = 10;
const EXTRA_HOTEL_COUNT = 50;
const ADMIN_SEED_EMAIL = process.env.ADMIN_EMAIL || "admin@gmail.com";
const ADMIN_SEED_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const adminSessions = new Map();

// Simple SHA-256 hash (no external deps needed)
function hashPassword(password) {
  return crypto.createHash("sha256").update(password + "staykart_salt").digest("hex");
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:8080" }));
app.use(express.json());

function dateRangeParams(checkIn, checkOut) {
  if (!checkIn || !checkOut) {
    return { checkIn: new Date().toISOString().slice(0, 10), checkOut: new Date(Date.now() + 86400000).toISOString().slice(0, 10) };
  }

  return { checkIn, checkOut };
}

function nightsBetween(checkIn, checkOut) {
  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  return Math.max(nights, 1);
}

function bookingReference(prefix = "SK") {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`.toUpperCase();
}

function publicAdmin(admin) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    last_login_at: admin.last_login_at,
  };
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = token ? adminSessions.get(token) : null;

  if (!session) {
    return res.status(401).json({ error: "Admin login required" });
  }

  req.admin = session.admin;
  next();
}

async function releaseExpiredHolds() {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const expired = await client.query(
      `
        select id, room_type_id, check_in, check_out, rooms
        from reservations
        where status = 'HELD'
          and payment_status = 'PENDING'
          and hold_expires_at < now()
          and released_at is null
        for update
      `,
    );

    for (const reservation of expired.rows) {
      await client.query(
        `
          update room_inventory
          set available_rooms = available_rooms + $1, updated_at = now()
          where room_type_id = $2
            and stay_date >= $3::date
            and stay_date < $4::date
        `,
        [reservation.rooms, reservation.room_type_id, reservation.check_in, reservation.check_out],
      );

      await client.query(
        `
          update reservations
          set status = 'EXPIRED',
              payment_status = 'EXPIRED',
              released_at = now(),
              updated_at = now()
          where id = $1
        `,
        [reservation.id],
      );
    }

    await client.query("commit");
    if (expired.rowCount) {
      searchCache.clear();
    }

    return expired.rowCount;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function releaseReservationInventory(client, reservation, nextStatus, nextPaymentStatus, cancellationReason = null) {
  if (reservation.released_at) {
    return;
  }

  await client.query(
    `
      update room_inventory
      set available_rooms = available_rooms + $1, updated_at = now()
      where room_type_id = $2
        and stay_date >= $3::date
        and stay_date < $4::date
    `,
    [reservation.rooms, reservation.room_type_id, reservation.check_in, reservation.check_out],
  );

  await client.query(
    `
      update reservations
      set status = $2,
          payment_status = $3,
          released_at = now(),
          cancelled_at = case when $2 = 'CANCELLED' then now() else cancelled_at end,
          cancellation_reason = coalesce($4, cancellation_reason),
          updated_at = now()
      where id = $1
    `,
    [reservation.id, nextStatus, nextPaymentStatus, cancellationReason],
  );
}

async function ensureRuntimeSchema() {
  await query(`
    create table if not exists admin_users (
      id bigserial primary key,
      name text not null,
      email text not null unique,
      password_hash text not null,
      role text not null default 'ADMIN',
      created_at timestamptz not null default now(),
      last_login_at timestamptz
    )
  `);
  await query(
    `
      insert into admin_users (name, email, password_hash, role)
      values ($1, $2, $3, 'SUPER_ADMIN')
      on conflict (email) do nothing
    `,
    ["StayKart Admin", ADMIN_SEED_EMAIL.toLowerCase(), hashPassword(ADMIN_SEED_PASSWORD)],
  );
  await query("alter table room_inventory add column if not exists total_rooms integer");
  await query("alter table room_inventory add column if not exists held_rooms integer not null default 0");
  await query("alter table room_inventory add column if not exists blocked_rooms integer not null default 0");
  await query("alter table room_inventory add column if not exists stop_sell boolean not null default false");
  await query("alter table room_inventory add column if not exists min_stay integer not null default 1");
  await query("alter table room_inventory add column if not exists max_stay integer");
  await query("alter table room_inventory add column if not exists source text not null default 'DIRECT'");
  await query("update room_inventory set total_rooms = available_rooms where total_rooms is null");
  await query("alter table reservations add column if not exists released_at timestamptz");
  await query("alter table reservations add column if not exists cancelled_at timestamptz");
  await query("alter table reservations add column if not exists cancellation_reason text");
  await query("alter table reservations add column if not exists supplier_reservation_id text");
  await query("alter table reservations add column if not exists updated_at timestamptz not null default now()");
  await query("alter table supplier_events add column if not exists processed_at timestamptz");
  await query("alter table supplier_events add column if not exists error_message text");

  await query(
    `
      insert into hotels (name, city, area, rating, reviews, price, original_price, tag)
      select
        'StayKart ' || city || ' Collection ' || gs,
        city,
        area,
        round((4.1 + random() * 0.8)::numeric, 1),
        (600 + random() * 3600)::int,
        base_price + ((gs % 5) * 650),
        base_price + ((gs % 5) * 650) + 2200,
        tag
      from generate_series(1, greatest(0, $1 - (select count(*)::int from hotels))) gs
      cross join lateral (
        select
          (array['Mumbai','Goa','Jaipur','Manali','Delhi','Bengaluru','Udaipur','Pune'])[1 + ((gs - 1) % 8)] as city,
          (array['Business District','Lake Road','Old Town','Airport Zone','Beachfront','Market Street','Heritage Quarter','Garden Enclave'])[1 + ((gs - 1) % 8)] as area,
          (array['Direct Contract','Channel Managed','Member Deal','Fast Confirmation'])[1 + ((gs - 1) % 4)] as tag,
          (array[5200,8200,4800,3900,5600,6100,7600,4700])[1 + ((gs - 1) % 8)] as base_price
      ) data
      on conflict do nothing
    `,
    [EXTRA_HOTEL_COUNT],
  );

  await query(
    `
      insert into room_types (hotel_id, name, capacity, bed, meal_plan, base_price, cancellable, supplier_code)
      select h.id, rt.name, rt.capacity, rt.bed, rt.meal_plan, rt.base_price, rt.cancellable, rt.supplier_code
      from hotels h
      cross join lateral (
        values
          ('Smart Saver', 2, 'Queen bed', 'Room only', greatest(h.price - 900, 2499), true, 'DIRECT'),
          ('Flex Breakfast', 3, 'King bed', 'Breakfast included', h.price, true, 'CHANNEL_MANAGER'),
          ('Family Suite', 4, 'King bed + sofa', 'Breakfast and dinner', h.price + 2600, false, 'EXPEDIA')
      ) as rt(name, capacity, bed, meal_plan, base_price, cancellable, supplier_code)
      on conflict do nothing
    `,
  );

  await query(
    `
      insert into room_inventory (room_type_id, stay_date, available_rooms, total_rooms, price, source)
      select
        rt.id,
        gs.stay_date::date,
        case
          when rt.name = 'Family Suite' then 3
          when rt.name = 'Smart Saver' then 8
          else 6
        end,
        case
          when rt.name = 'Family Suite' then 3
          when rt.name = 'Smart Saver' then 8
          else 6
        end,
        rt.base_price + ((extract(dow from gs.stay_date)::int in (5, 6))::int * 900),
        rt.supplier_code
      from room_types rt
      cross join generate_series(current_date, current_date + interval '180 days', interval '1 day') as gs(stay_date)
      on conflict do nothing
    `,
  );
}

app.get("/api/health", async (_req, res) => {
  try {
    const { rows } = await query("select now() as database_time");
    res.json({ ok: true, databaseTime: rows[0].database_time });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: "Database connection failed" });
  }
});

app.get("/api/hotels", async (req, res) => {
  try {
    await releaseExpiredHolds();
    const city = String(req.query.city || "").trim();
    const adults = Number(req.query.adults || 1);
    const rooms = Number(req.query.rooms || 1);
    const { checkIn, checkOut } = dateRangeParams(req.query.checkIn, req.query.checkOut);
    const nights = nightsBetween(checkIn, checkOut);

    const params = [`%${city}%`, checkIn, checkOut, rooms, adults, nights];
    const { rows } = await query(
      `
        with eligible_room_types as (
          select
            rt.hotel_id,
            rt.id as room_type_id,
            min(ri.price) as live_price,
            min(ri.available_rooms) as available_rooms
          from room_types rt
          join room_inventory ri on ri.room_type_id = rt.id
          where ri.stay_date >= $2::date
            and ri.stay_date < $3::date
            and ri.stop_sell = false
            and rt.capacity >= ceil($5::numeric / $4::numeric)
            and $6 >= ri.min_stay
            and (ri.max_stay is null or $6 <= ri.max_stay)
          group by rt.hotel_id, rt.id
          having min(ri.available_rooms) >= $4
            and count(distinct ri.stay_date) = $6
        )
        select
          h.id, h.name, h.city, h.area, h.rating, h.reviews, h.price, h.original_price, h.tag,
          h.price as live_price,
          min(ert.live_price) as inventory_price,
          max(ert.available_rooms) as available_rooms,
          count(distinct ert.room_type_id) as room_type_count
        from hotels h
        join eligible_room_types ert on ert.hotel_id = h.id
        where 1 = 1
          and ($1::text = '%%' or h.city ilike $1 or h.area ilike $1 or h.name ilike $1)
        group by h.id
        order by h.price, h.rating desc, h.reviews desc
        limit 24
      `,
      params,
    );

    res.json({ hotels: rows, meta: { source: "database-live", refreshMs: LIVE_REFRESH_MS } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load hotels" });
  }
});

app.get("/api/hotels/:id/rooms", async (req, res) => {
  try {
    await releaseExpiredHolds();
    const hotelId = Number(req.params.id);
    const rooms = Number(req.query.rooms || 1);
    const adults = Number(req.query.adults || 1);
    const { checkIn, checkOut } = dateRangeParams(req.query.checkIn, req.query.checkOut);
    const nights = nightsBetween(checkIn, checkOut);

    const { rows } = await query(
      `
        select
          rt.id, rt.name, rt.capacity, rt.bed, rt.meal_plan, rt.cancellable, rt.supplier_code,
          min(ri.available_rooms) as available_rooms,
          max(ri.stop_sell::int)::boolean as stop_sell,
          round(avg(ri.price))::int as nightly_price,
          (round(avg(ri.price))::int * $4 * $5) as total_price
        from room_types rt
        join room_inventory ri on ri.room_type_id = rt.id
        where rt.hotel_id = $1
          and ri.stay_date >= $2::date
          and ri.stay_date < $3::date
          and ri.stop_sell = false
          and rt.capacity >= ceil($6::numeric / $4::numeric)
          and $5 >= ri.min_stay
          and (ri.max_stay is null or $5 <= ri.max_stay)
        group by rt.id
        having min(ri.available_rooms) >= $4
          and count(distinct ri.stay_date) = $5
        order by total_price asc
      `,
      [hotelId, checkIn, checkOut, rooms, nights, adults],
    );

    res.json({ rooms: rows, meta: { checkIn, checkOut, nights, freshness: "database-live", refreshMs: LIVE_REFRESH_MS } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load rooms" });
  }
});

app.post("/api/searches", async (req, res) => {
  try {
    const { city, checkIn, checkOut, adults, rooms } = req.body;

    if (!city || !checkIn || !checkOut) {
      return res.status(400).json({ error: "city, checkIn, and checkOut are required" });
    }

    const { rows } = await query(
      `
        insert into searches (city, check_in, check_out, adults, rooms)
        values ($1, $2, $3, $4, $5)
        returning id, city, check_in, check_out, adults, rooms, created_at
      `,
      [city, checkIn, checkOut, Number(adults || 1), Number(rooms || 1)],
    );

    res.status(201).json({ search: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to save search" });
  }
});

app.post("/api/reservations", async (req, res) => {
  const client = await pool.connect();

  try {
    const { reservationId, hotelId, roomTypeId, checkIn, checkOut, rooms, guestName, guestEmail } = req.body;
    const reference = reservationId || bookingReference();
    const roomCount = Number(rooms || 1);
    const nights = nightsBetween(checkIn, checkOut);

    if (!hotelId || !roomTypeId || !checkIn || !checkOut || !guestName || !guestEmail) {
      return res.status(400).json({ error: "hotelId, roomTypeId, dates, guestName, and guestEmail are required" });
    }

    await client.query("begin");
    await releaseExpiredHolds();

    const existing = await client.query("select * from reservations where booking_reference = $1", [reference]);
    if (existing.rowCount) {
      await client.query("commit");
      return res.json({ reservation: existing.rows[0], idempotentReplay: true });
    }

    const lockedInventory = await client.query(
      `
        select available_rooms, price
        from room_inventory
        where room_type_id = $1
          and stay_date >= $2::date
          and stay_date < $3::date
          and stop_sell = false
        for update
      `,
      [roomTypeId, checkIn, checkOut],
    );

    const availableRooms = Math.min(...lockedInventory.rows.map((row) => Number(row.available_rooms)));
    const nightlyPrice = Math.round(
      lockedInventory.rows.reduce((sum, row) => sum + Number(row.price), 0) / Math.max(lockedInventory.rows.length, 1),
    );

    if (lockedInventory.rows.length !== nights || availableRooms < roomCount) {
      await client.query("rollback");
      return res.status(409).json({ error: "Room inventory changed. Please refresh availability." });
    }

    const amount = nightlyPrice * roomCount * nights;

    const inventoryUpdate = await client.query(
      `
        update room_inventory
        set available_rooms = available_rooms - $1, updated_at = now()
        where room_type_id = $2
          and stay_date >= $3::date
          and stay_date < $4::date
          and available_rooms >= $1
          and stop_sell = false
        returning id
      `,
      [roomCount, roomTypeId, checkIn, checkOut],
    );

    if (inventoryUpdate.rowCount !== nights) {
      await client.query("rollback");
      return res.status(409).json({ error: "Room inventory changed. Please refresh availability." });
    }

    const created = await client.query(
      `
        insert into reservations
          (booking_reference, hotel_id, room_type_id, guest_name, guest_email, check_in, check_out, rooms, amount, hold_expires_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() + ($10 || ' minutes')::interval)
        returning *
      `,
      [reference, hotelId, roomTypeId, guestName, guestEmail, checkIn, checkOut, roomCount, amount, HOLD_MINUTES],
    );

    searchCache.clear();
    await client.query("commit");
    res.status(201).json({ reservation: created.rows[0], idempotentReplay: false });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Unable to create reservation" });
  } finally {
    client.release();
  }
});

app.post("/api/payments/confirm", async (req, res) => {
  const client = await pool.connect();

  try {
    const { reservationId, success = true } = req.body;

    await client.query("begin");
    const reservation = await client.query(
      `
        select *
        from reservations
        where booking_reference = $1
        for update
      `,
      [reservationId],
    );

    if (!reservation.rows.length) {
      await client.query("rollback");
      return res.status(404).json({ error: "Reservation not found" });
    }

    if (success) {
      const confirmed = await client.query(
        `
          update reservations
          set status = 'CONFIRMED',
              payment_status = 'PAID',
              updated_at = now()
          where booking_reference = $1
          returning *
        `,
        [reservationId],
      );
      await client.query("commit");
      return res.json({ reservation: confirmed.rows[0] });
    }

    await releaseReservationInventory(client, reservation.rows[0], "PAYMENT_FAILED", "FAILED");
    const failed = await client.query("select * from reservations where booking_reference = $1", [reservationId]);
    searchCache.clear();
    await client.query("commit");
    res.json({ reservation: failed.rows[0] });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Unable to confirm payment" });
  } finally {
    client.release();
  }
});

app.get("/api/reservations/:reference", async (req, res) => {
  try {
    const { rows } = await query(
      `
        select
          r.*,
          h.name as hotel_name,
          rt.name as room_name
        from reservations r
        join hotels h on h.id = r.hotel_id
        join room_types rt on rt.id = r.room_type_id
        where r.booking_reference = $1
      `,
      [req.params.reference],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    res.json({ reservation: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load reservation" });
  }
});

app.post("/api/reservations/:reference/cancel", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const reservation = await client.query(
      "select * from reservations where booking_reference = $1 for update",
      [req.params.reference],
    );

    if (!reservation.rows.length) {
      await client.query("rollback");
      return res.status(404).json({ error: "Reservation not found" });
    }

    if (!["HELD", "CONFIRMED"].includes(reservation.rows[0].status)) {
      await client.query("commit");
      return res.json({ reservation: reservation.rows[0], alreadyClosed: true });
    }

    const paymentStatus = reservation.rows[0].payment_status === "PAID" ? "REFUND_PENDING" : "CANCELLED";
    await releaseReservationInventory(client, reservation.rows[0], "CANCELLED", paymentStatus, req.body?.reason || "Guest cancelled");
    const cancelled = await client.query("select * from reservations where booking_reference = $1", [req.params.reference]);

    searchCache.clear();
    await client.query("commit");
    res.json({ reservation: cancelled.rows[0] });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Unable to cancel reservation" });
  } finally {
    client.release();
  }
});

app.post("/api/suppliers/events", async (req, res) => {
  try {
    const { roomTypeId, priceDelta = -350, availableDelta = 1, supplier = "SIMULATED_SUPPLIER" } = req.body;
    const target = roomTypeId
      ? { rows: [{ id: roomTypeId }] }
      : await query("select id from room_types order by random() limit 1");

    if (!target.rows.length) {
      return res.status(404).json({ error: "No room type available" });
    }

    const selectedRoomTypeId = Number(target.rows[0].id);
    const updated = await query(
      `
        update room_inventory
        set
          price = greatest(price + $2, 999),
          available_rooms = greatest(available_rooms + $3, 0),
          updated_at = now()
        where room_type_id = $1 and stay_date between current_date and current_date + interval '14 days'
        returning id
      `,
      [selectedRoomTypeId, Number(priceDelta), Number(availableDelta)],
    );

    const event = await query(
      `
        insert into supplier_events (supplier, room_type_id, event_type, payload)
        values ($1, $2, 'PRICE_AVAILABILITY_DELTA', $3::jsonb)
        returning *
      `,
      [supplier, selectedRoomTypeId, JSON.stringify({ priceDelta, availableDelta, affectedDates: updated.rowCount })],
    );

    searchCache.clear();
    res.status(201).json({ event: event.rows[0], message: "Supplier delta normalized and indexed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to process supplier event" });
  }
});

app.post("/api/inventory/sync", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      supplier = "CHANNEL_MANAGER",
      hotelId,
      roomTypeId,
      updates = [],
    } = req.body;

    if (!roomTypeId || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: "roomTypeId and updates[] are required" });
    }

    await client.query("begin");
    const event = await client.query(
      `
        insert into supplier_events (supplier, hotel_id, room_type_id, event_type, payload, status)
        values ($1, $2, $3, 'ARI_SYNC', $4::jsonb, 'PROCESSING')
        returning *
      `,
      [supplier, hotelId || null, roomTypeId, JSON.stringify({ updates })],
    );

    let affectedDates = 0;
    for (const update of updates) {
      if (!update.date) {
        continue;
      }

      const availableRooms = Number(update.availableRooms ?? update.available_rooms ?? 0);
      const totalRooms = Number(update.totalRooms ?? update.total_rooms ?? availableRooms);
      const price = Number(update.price ?? 0);

      await client.query(
        `
          insert into room_inventory
            (room_type_id, stay_date, available_rooms, total_rooms, price, currency, stop_sell, min_stay, max_stay, source, updated_at)
          values ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, now())
          on conflict (room_type_id, stay_date)
          do update set
            available_rooms = excluded.available_rooms,
            total_rooms = excluded.total_rooms,
            price = excluded.price,
            currency = excluded.currency,
            stop_sell = excluded.stop_sell,
            min_stay = excluded.min_stay,
            max_stay = excluded.max_stay,
            source = excluded.source,
            updated_at = now()
        `,
        [
          roomTypeId,
          update.date,
          Math.max(availableRooms, 0),
          Math.max(totalRooms, availableRooms, 0),
          Math.max(price, 999),
          update.currency || "INR",
          Boolean(update.stopSell ?? update.stop_sell ?? false),
          Number(update.minStay ?? update.min_stay ?? 1),
          update.maxStay ?? update.max_stay ?? null,
          supplier,
        ],
      );
      affectedDates += 1;
    }

    const processed = await client.query(
      `
        update supplier_events
        set status = 'INDEXED',
            processed_at = now(),
            payload = payload || $2::jsonb
        where id = $1
        returning *
      `,
      [event.rows[0].id, JSON.stringify({ affectedDates })],
    );

    searchCache.clear();
    await client.query("commit");
    res.status(201).json({ event: processed.rows[0], affectedDates });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Unable to sync inventory" });
  } finally {
    client.release();
  }
});

app.get("/api/admin/inventory", requireAdmin, async (req, res) => {
  try {
    const roomTypeId = Number(req.query.roomTypeId || 0);
    const from = req.query.from || new Date().toISOString().slice(0, 10);
    const to = req.query.to || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

    if (!roomTypeId) {
      return res.status(400).json({ error: "roomTypeId is required" });
    }

    const { rows } = await query(
      `
        select
          ri.id,
          ri.stay_date,
          ri.total_rooms,
          ri.available_rooms,
          ri.blocked_rooms,
          ri.min_stay,
          ri.max_stay,
          ri.stop_sell,
          ri.price,
          ri.currency,
          ri.source,
          ri.updated_at,
          rt.name as room_name,
          h.name as hotel_name
        from room_inventory ri
        join room_types rt on rt.id = ri.room_type_id
        join hotels h on h.id = rt.hotel_id
        where ri.room_type_id = $1
          and ri.stay_date >= $2::date
          and ri.stay_date <= $3::date
        order by ri.stay_date
      `,
      [roomTypeId, from, to],
    );

    res.json({ inventory: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load inventory" });
  }
});

app.post("/api/ops/expire-holds", async (_req, res) => {
  try {
    const expired = await releaseExpiredHolds();
    res.json({ expired });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to expire holds" });
  }
});

app.get("/api/ops/status", async (_req, res) => {
  try {
    const expiredHolds = await releaseExpiredHolds();
    const [reservations, events, inventory, sampleRoomType] = await Promise.all([
      query("select status, payment_status, count(*)::int as count from reservations group by status, payment_status order by status"),
      query("select supplier, event_type, status, count(*)::int as count, max(created_at) as latest_event from supplier_events group by supplier, event_type, status order by latest_event desc limit 8"),
      query("select count(*)::int as indexed_days, sum(available_rooms)::int as sellable_room_nights, min(updated_at) as oldest_inventory_update, max(updated_at) as newest_inventory_update from room_inventory"),
      query("select id from room_types order by id limit 1"),
    ]);

    res.json({
      cache: { entries: searchCache.size, ttlMs: 0, strategy: "disabled for live database-backed availability reads" },
      expiredHolds,
      sampleRoomTypeId: sampleRoomType.rows[0]?.id,
      services: [
        { name: "Hotel Listing Service", status: "healthy", backingStore: "Postgres search projection" },
        { name: "Room Inventory Service", status: "healthy", backingStore: "date inventory index" },
        { name: "Reservation Service", status: "healthy", consistency: "transactional hold + idempotency key" },
        { name: "Supplier ARI Sync Adapter", status: "healthy", queue: "supplier_events audit log" },
      ],
      reservations: reservations.rows,
      supplierEvents: events.rows,
      inventory: inventory.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load ops status" });
  }
});

// ── Auth ──────────────────────────────────────────────────────────────────
// Admin control plane
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const passwordHash = hashPassword(password);
    const { rows } = await query(
      `
        update admin_users
        set last_login_at = now()
        where email = $1 and password_hash = $2
        returning id, name, email, role, last_login_at
      `,
      [email.toLowerCase().trim(), passwordHash],
    );

    if (!rows.length) {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const admin = publicAdmin(rows[0]);
    adminSessions.set(token, { admin, createdAt: Date.now() });
    res.json({ token, admin });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to login admin" });
  }
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

app.get("/api/admin/summary", requireAdmin, async (_req, res) => {
  try {
    await releaseExpiredHolds();
    const [hotels, reservations, revenue, inventory, users, searches] = await Promise.all([
      query("select count(*)::int as total from hotels"),
      query("select status, payment_status, count(*)::int as count from reservations group by status, payment_status order by status"),
      query("select coalesce(sum(amount), 0)::int as total from reservations where payment_status in ('PAID', 'REFUND_PENDING')"),
      query(`
        select
          coalesce(sum(available_rooms), 0)::int as available_room_nights,
          coalesce(sum(case when stop_sell then 1 else 0 end), 0)::int as stopped_dates,
          coalesce(count(*), 0)::int as indexed_dates
        from room_inventory
      `),
      query("select count(*)::int as total from users"),
      query("select city, count(*)::int as count from searches group by city order by count desc limit 6"),
    ]);

    res.json({
      totals: {
        hotels: hotels.rows[0].total,
        users: users.rows[0].total,
        revenue: revenue.rows[0].total,
        availableRoomNights: inventory.rows[0].available_room_nights,
        stoppedDates: inventory.rows[0].stopped_dates,
        indexedDates: inventory.rows[0].indexed_dates,
      },
      reservations: reservations.rows,
      topSearches: searches.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load admin summary" });
  }
});

app.get("/api/admin/hotels", requireAdmin, async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const { rows } = await query(
      `
        select
          h.*,
          count(distinct rt.id)::int as room_type_count,
          coalesce(sum(ri.available_rooms), 0)::int as available_room_nights
        from hotels h
        left join room_types rt on rt.hotel_id = h.id
        left join room_inventory ri on ri.room_type_id = rt.id and ri.stay_date >= current_date and ri.stay_date < current_date + interval '30 days'
        where $1::text = '' or h.name ilike $2 or h.city ilike $2 or h.area ilike $2
        group by h.id
        order by h.created_at desc, h.id desc
        limit 80
      `,
      [search, `%${search}%`],
    );
    res.json({ hotels: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load admin hotels" });
  }
});

app.post("/api/admin/hotels", requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, city, area, rating = 4.5, reviews = 0, price, originalPrice, tag = "Admin Added" } = req.body;
    if (!name || !city || !area || !price) {
      return res.status(400).json({ error: "name, city, area, and price are required" });
    }

    await client.query("begin");
    const hotel = await client.query(
      `
        insert into hotels (name, city, area, rating, reviews, price, original_price, tag)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning *
      `,
      [name.trim(), city.trim(), area.trim(), Number(rating), Number(reviews), Number(price), Number(originalPrice || price), tag],
    );

    const roomType = await client.query(
      `
        insert into room_types (hotel_id, name, capacity, bed, meal_plan, base_price, cancellable, supplier_code)
        values ($1, 'Flex Breakfast', 2, 'Queen bed', 'Breakfast included', $2, true, 'DIRECT')
        returning *
      `,
      [hotel.rows[0].id, Number(price)],
    );

    await client.query(
      `
        insert into room_inventory (room_type_id, stay_date, available_rooms, total_rooms, price, source)
        select $1, gs.stay_date::date, 6, 6, $2, 'DIRECT'
        from generate_series(current_date, current_date + interval '180 days', interval '1 day') as gs(stay_date)
        on conflict do nothing
      `,
      [roomType.rows[0].id, Number(price)],
    );

    searchCache.clear();
    await client.query("commit");
    res.status(201).json({ hotel: hotel.rows[0] });
  } catch (error) {
    await client.query("rollback");
    if (error.code === "23505") {
      return res.status(409).json({ error: "A hotel with this name already exists" });
    }
    console.error(error);
    res.status(500).json({ error: "Unable to create hotel" });
  } finally {
    client.release();
  }
});

app.patch("/api/admin/hotels/:id", requireAdmin, async (req, res) => {
  try {
    const { name, city, area, rating, reviews, price, originalPrice, tag } = req.body;
    const { rows } = await query(
      `
        update hotels
        set
          name = coalesce($2, name),
          city = coalesce($3, city),
          area = coalesce($4, area),
          rating = coalesce($5, rating),
          reviews = coalesce($6, reviews),
          price = coalesce($7, price),
          original_price = coalesce($8, original_price),
          tag = coalesce($9, tag)
        where id = $1
        returning *
      `,
      [
        Number(req.params.id),
        name?.trim(),
        city?.trim(),
        area?.trim(),
        rating === undefined ? null : Number(rating),
        reviews === undefined ? null : Number(reviews),
        price === undefined ? null : Number(price),
        originalPrice === undefined ? null : Number(originalPrice),
        tag === undefined ? null : tag,
      ],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Hotel not found" });
    }

    searchCache.clear();
    res.json({ hotel: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to update hotel" });
  }
});

app.delete("/api/admin/hotels/:id", requireAdmin, async (req, res) => {
  try {
    const inUse = await query("select count(*)::int as count from reservations where hotel_id = $1", [Number(req.params.id)]);
    if (inUse.rows[0].count > 0) {
      return res.status(409).json({ error: "Hotels with reservations cannot be deleted" });
    }

    const deleted = await query("delete from hotels where id = $1 returning id", [Number(req.params.id)]);
    if (!deleted.rows.length) {
      return res.status(404).json({ error: "Hotel not found" });
    }

    searchCache.clear();
    res.json({ deleted: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to delete hotel" });
  }
});

app.get("/api/admin/room-types", requireAdmin, async (req, res) => {
  try {
    const hotelId = Number(req.query.hotelId || 0);
    const { rows } = await query(
      `
        select rt.*, h.name as hotel_name
        from room_types rt
        join hotels h on h.id = rt.hotel_id
        where $1::bigint = 0 or rt.hotel_id = $1
        order by h.name, rt.name
      `,
      [hotelId],
    );
    res.json({ roomTypes: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load room types" });
  }
});

app.patch("/api/admin/inventory/:id", requireAdmin, async (req, res) => {
  try {
    const { availableRooms, totalRooms, blockedRooms, price, stopSell, minStay, maxStay } = req.body;
    const { rows } = await query(
      `
        update room_inventory
        set
          available_rooms = coalesce($2, available_rooms),
          total_rooms = coalesce($3, total_rooms),
          blocked_rooms = coalesce($4, blocked_rooms),
          price = coalesce($5, price),
          stop_sell = coalesce($6, stop_sell),
          min_stay = coalesce($7, min_stay),
          max_stay = $8,
          updated_at = now()
        where id = $1
        returning *
      `,
      [
        Number(req.params.id),
        availableRooms === undefined ? null : Math.max(Number(availableRooms), 0),
        totalRooms === undefined ? null : Math.max(Number(totalRooms), 0),
        blockedRooms === undefined ? null : Math.max(Number(blockedRooms), 0),
        price === undefined ? null : Math.max(Number(price), 999),
        stopSell === undefined ? null : Boolean(stopSell),
        minStay === undefined ? null : Math.max(Number(minStay), 1),
        maxStay === undefined || maxStay === "" ? null : Number(maxStay),
      ],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Inventory row not found" });
    }

    searchCache.clear();
    res.json({ inventory: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to update inventory" });
  }
});

app.get("/api/admin/reservations", requireAdmin, async (req, res) => {
  try {
    await releaseExpiredHolds();
    const status = String(req.query.status || "").trim();
    const search = String(req.query.search || "").trim();
    const { rows } = await query(
      `
        select
          r.*,
          h.name as hotel_name,
          h.city,
          rt.name as room_name
        from reservations r
        join hotels h on h.id = r.hotel_id
        join room_types rt on rt.id = r.room_type_id
        where ($1::text = '' or r.status = $1)
          and ($2::text = '' or r.booking_reference ilike $3 or r.guest_name ilike $3 or r.guest_email ilike $3 or h.name ilike $3)
        order by r.created_at desc
        limit 120
      `,
      [status, search, `%${search}%`],
    );
    res.json({ reservations: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load reservations" });
  }
});

app.post("/api/admin/reservations/:reference/confirm", requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      `
        update reservations
        set status = 'CONFIRMED',
            payment_status = 'PAID',
            updated_at = now()
        where booking_reference = $1 and status in ('HELD', 'CONFIRMED')
        returning *
      `,
      [req.params.reference],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Open reservation not found" });
    }

    res.json({ reservation: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to confirm reservation" });
  }
});

app.post("/api/admin/reservations/:reference/cancel", requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const reservation = await client.query("select * from reservations where booking_reference = $1 for update", [req.params.reference]);
    if (!reservation.rows.length) {
      await client.query("rollback");
      return res.status(404).json({ error: "Reservation not found" });
    }

    if (!["HELD", "CONFIRMED"].includes(reservation.rows[0].status)) {
      await client.query("commit");
      return res.json({ reservation: reservation.rows[0], alreadyClosed: true });
    }

    const paymentStatus = reservation.rows[0].payment_status === "PAID" ? "REFUND_PENDING" : "CANCELLED";
    await releaseReservationInventory(client, reservation.rows[0], "CANCELLED", paymentStatus, req.body?.reason || "Admin cancelled");
    const cancelled = await client.query("select * from reservations where booking_reference = $1", [req.params.reference]);

    searchCache.clear();
    await client.query("commit");
    res.json({ reservation: cancelled.rows[0] });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    res.status(500).json({ error: "Unable to cancel reservation" });
  } finally {
    client.release();
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const password_hash = hashPassword(password);
    const { rows } = await query(
      `insert into users (name, email, password_hash)
       values ($1, $2, $3)
       returning id, name, email, created_at`,
      [name.trim(), email.toLowerCase().trim(), password_hash]
    );
    res.status(201).json({ user: rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    console.error(error);
    res.status(500).json({ error: "Unable to register" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const password_hash = hashPassword(password);
    const { rows } = await query(
      `update users
       set last_login_at = now()
       where email = $1 and password_hash = $2
       returning id, name, email, created_at, last_login_at`,
      [email.toLowerCase().trim(), password_hash]
    );
    if (!rows.length) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    res.json({ user: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to login" });
  }
});

app.get("/api/auth/users", async (_req, res) => {
  try {
    const { rows } = await query(
      `select id, name, email, created_at, last_login_at from users order by created_at desc`
    );
    res.json({ users: rows, total: rows.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to fetch users" });
  }
});

ensureRuntimeSchema()
  .then(() => {
    setInterval(() => {
      releaseExpiredHolds().catch((error) => console.error("Hold expiry worker failed", error));
    }, 60_000);

    app.listen(port, () => {
      console.log(`API server running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Unable to initialize API schema", error);
    process.exit(1);
  });
