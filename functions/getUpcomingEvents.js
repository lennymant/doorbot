const axios = require('axios');
require('dotenv').config();

async function getUpcomingEvents({ organization_id, page = 1 }) {
  const orgId = organization_id || '114992263391';
  if (!orgId) throw new Error('Missing organization ID');

  const token = process.env.EVENTBRITE_PRIVATE_TOKEN || 'R3RDCCXFRH2PPJ42Q5SL';
  if (!token) throw new Error('Missing EVENTBRITE_PRIVATE_TOKEN');

  const url = `https://www.eventbriteapi.com/v3/organizations/${orgId}/events/`;
  console.log(`🔗 GET ${url}?page=${page} via Bearer auth`);
  console.log('Debug info:', {
    orgId,
    tokenLength: token ? token.length : 0,
    tokenPrefix: token ? token.substring(0, 10) + '...' : 'none'
  });

  try {
    const res = await axios.get(url, {
      params: { token, page, order_by: 'start_asc', expand: 'venue', status: 'live' }
    });

    // Add status field to each event based on ticket availability
    const eventsWithStatus = res.data.events.map(event => {
      const totalCapacity = event.capacity || 0;
      const ticketsSold = event.ticket_availability?.total_sold || 0;
      const ticketsAvailable = totalCapacity - ticketsSold;
      const percentageAvailable = totalCapacity > 0 ? (ticketsAvailable / totalCapacity) * 100 : 0;

      let status;
      if (ticketsAvailable === 0) {
        status = "SOLD OUT";
      } else if (percentageAvailable < 15) {
        status = "NEARLY FULL";
      } else {
        status = "TAKING BOOKINGS";
      }

      // Log detailed status info for each event
      console.log(`\n📊 Event Status for "${event.name}":`);
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

    // Log summary of all events
    console.log('\n📈 Event Status Summary:');
    const statusCounts = eventsWithStatus.reduce((acc, event) => {
      acc[event.status] = (acc[event.status] || 0) + 1;
      return acc;
    }, {});
    console.log('Status Distribution:', statusCounts);

    return {
      ...res.data,
      events: eventsWithStatus
    };

  } catch (err) {
    console.warn('⚠️ Query param auth failed:', err.response ? {
      status: err.response.status,
      statusText: err.response.statusText,
      data: err.response.data
    } : err.message);
    console.warn('Retrying with Bearer auth…');
    const res2 = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page, order_by: 'start_asc', expand: 'venue', status: 'live' }
    });

    // Add status field to each event based on ticket availability
    const eventsWithStatus = res2.data.events.map(event => {
      const totalCapacity = event.capacity || 0;
      const ticketsSold = event.ticket_availability?.total_sold || 0;
      const ticketsAvailable = totalCapacity - ticketsSold;
      const percentageAvailable = totalCapacity > 0 ? (ticketsAvailable / totalCapacity) * 100 : 0;

      let status;
      if (ticketsAvailable === 0) {
        status = "SOLD OUT";
      } else if (percentageAvailable < 15) {
        status = "NEARLY FULL";
      } else {
        status = "TAKING BOOKINGS";
      }

      // Log detailed status info for each event
      console.log(`\n📊 Event Status for "${event.name}":`);
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

    // Log summary of all events
    console.log('\n📈 Event Status Summary:');
    const statusCounts = eventsWithStatus.reduce((acc, event) => {
      acc[event.status] = (acc[event.status] || 0) + 1;
      return acc;
    }, {});
    console.log('Status Distribution:', statusCounts);

    return {
      ...res2.data,
      events: eventsWithStatus
    };
  }
}

module.exports = getUpcomingEvents;
