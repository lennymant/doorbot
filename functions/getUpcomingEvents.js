const axios = require('axios');
require('dotenv').config();

/**
 * Calculate ticket status and log event details.
 */
function addStatusAndLog(events) {
  console.log('📥 addStatusAndLog invoked, events count:', events.length);

  const eventsWithStatus = events.map(event => {
    // Debug: Log full event object
    console.log('\n🔍 Raw Event Data:', JSON.stringify(event, null, 2));

    const totalCapacity = event.capacity || 0;
    const ticketsSold = event.ticket_classes?.reduce(
      (sum, tc) => sum + (tc.quantity_sold || 0), 0
    ) || 0;
    const ticketsAvailable = totalCapacity - ticketsSold;
    const percentageAvailable = totalCapacity > 0
      ? (ticketsAvailable / totalCapacity) * 100
      : 0;

    let status;
    if (ticketsAvailable === 0) {
      status = 'SOLD OUT';
    } else if (percentageAvailable < 15) {
      status = 'NEARLY FULL';
    } else {
      status = 'TAKING BOOKINGS';
    }

    // Log status details
    console.log(`\n📊 Event Status for "${event.name?.text || event.name}":`);
    console.log(`   Total Capacity: ${totalCapacity}`);
    console.log(`   Tickets Sold: ${ticketsSold}`);
    console.log(`   Tickets Available: ${ticketsAvailable}`);
    console.log(`   Percentage Available: ${percentageAvailable.toFixed(1)}%`);
    console.log(`   Status: ${status}`);

    return {
      ...event,
      status,
      tickets_available: ticketsAvailable,
      percentage_available: percentageAvailable
    };
  });

  // Summary log
  console.log('\n📈 Event Status Summary:');
  const statusCounts = eventsWithStatus.reduce((acc, event) => {
    acc[event.status] = (acc[event.status] || 0) + 1;
    return acc;
  }, {});
  console.log('Status Distribution:', statusCounts);

  return eventsWithStatus;
}

/**
 * Fetch a full event object by ID, including ticket_classes and venue.
 */
async function fetchFullEvent(eventId, token) {
  const url = `https://www.eventbriteapi.com/v3/events/${eventId}/`;
  const res = await axios.get(url, {
    params: { expand: 'ticket_classes,venue', token }
  });
  return res.data;
}

/**
 * Fetch upcoming events and enrich each with ticket status.
 */
async function getUpcomingEvents({ organization_id, page = 1 }) {
  const orgId = organization_id || '114992263391';
  if (!orgId) throw new Error('Missing organization ID');

  const token = process.env.EVENTBRITE_PRIVATE_TOKEN || 'R3RDCCXFRH2PPJ42Q5SL';
  if (!token) throw new Error('Missing EVENTBRITE_PRIVATE_TOKEN');

  const baseUrl = `https://www.eventbriteapi.com/v3/organizations/${orgId}/events/`;
  const commonParams = {
    page,
    order_by: 'start_asc',
    expand: 'venue', // not ticket_classes here — we fetch them individually
    status: 'live'
  };

  console.log(`🔗 GET ${baseUrl}?page=${page} via Bearer auth`);
  console.log('Debug info:', {
    orgId,
    tokenLength: token.length,
    tokenPrefix: `${token.slice(0, 10)}...`
  });

  let eventList;

  try {
    const res = await axios.get(baseUrl, { params: { ...commonParams, token } });
    eventList = res.data.events;
  } catch (err) {
    console.warn('⚠️ Token as query param failed:', err.message);
    const res2 = await axios.get(baseUrl, {
      headers: { Authorization: `Bearer ${token}` },
      params: commonParams
    });
    eventList = res2.data.events;
  }

  if (!Array.isArray(eventList) || eventList.length === 0) {
    console.warn('⚠️ No events found');
    return { events: [] };
  }

  // Fetch full data (with ticket_classes) for each event
  const fullEvents = await Promise.all(
    eventList.map(e => fetchFullEvent(e.id, token))
  );

  const eventsWithStatus = addStatusAndLog(fullEvents);

  return {
    events: eventsWithStatus,
    pagination: {
      page,
      total: fullEvents.length
    }
  };
}

module.exports = getUpcomingEvents;
