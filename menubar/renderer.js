const API_BASE = 'http://localhost:9001/event';

// DOM Elements
const loading = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');
const eventsList = document.getElementById('eventsList');
const refreshBtn = document.getElementById('refreshBtn');
const footerStatus = document.getElementById('footerStatus');
const tabs = document.querySelectorAll('.tab');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const trashCount = document.getElementById('trashCount');

let currentTab = 'upcoming';
let searchTimeout = null;
let trashedEvents = []; // UI-only trash — no backend calls

const fetchMailsBtn = document.getElementById('fetchMailsBtn');

// ========== TAB SWITCHING ==========
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;

        if (currentTab === 'trash') {
            renderTrash();
        } else {
            fetchEvents();
        }
    });
});

// ========== ACTIONS ==========
refreshBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.add('hidden');
    if (currentTab === 'trash') {
        renderTrash();
    } else {
        fetchEvents();
    }
});

fetchMailsBtn.addEventListener('click', async () => {
    fetchMailsBtn.classList.add('loading');
    const originalText = fetchMailsBtn.innerHTML;
    
    try {
        const res = await fetch(`${API_BASE}/load`);
        const data = await res.json();
        
        if (res.ok) {
            // Wait a moment for GAS to process and hit webhook
            fetchMailsBtn.innerHTML = 'Sent!';
            setTimeout(() => {
                fetchEvents();
                fetchMailsBtn.innerHTML = originalText;
                fetchMailsBtn.classList.remove('loading');
            }, 5000);
        } else {
            throw new Error(data.message);
        }
    } catch (err) {
        console.error('Fetch trigger failed:', err);
        fetchMailsBtn.innerHTML = 'Error';
        setTimeout(() => {
            fetchMailsBtn.innerHTML = originalText;
            fetchMailsBtn.classList.remove('loading');
        }, 2000);
    }
});

// ========== SEARCH ==========
searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();

    if (query.length > 0) {
        searchClear.classList.remove('hidden');
    } else {
        searchClear.classList.add('hidden');
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        if (query.length > 0) {
            searchEvents(query);
        } else {
            if (currentTab === 'trash') {
                renderTrash();
            } else {
                fetchEvents();
            }
        }
    }, 300);
});

searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.add('hidden');
    if (currentTab === 'trash') {
        renderTrash();
    } else {
        fetchEvents();
    }
});

// ========== SEARCH EVENTS ==========
async function searchEvents(query) {
    showLoading();
    refreshBtn.classList.add('spinning');

    try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        renderEvents(data.events || []);
        footerStatus.textContent = `Results for "${query}"`;
    } catch (err) {
        console.error('Search failed:', err);
        showEmpty('⚠️', 'Search failed', 'Is your backend running?');
    } finally {
        refreshBtn.classList.remove('spinning');
    }
}

// ========== FETCH EVENTS ==========
async function fetchEvents() {
    showLoading();

    refreshBtn.classList.add('spinning');

    let endpoint;
    switch (currentTab) {
        case 'upcoming':
            endpoint = `${API_BASE}/upcoming`;
            break;
        case 'past':
            endpoint = `${API_BASE}/past/7`;
            break;
        case 'all':
            endpoint = `${API_BASE}/all`;
            break;
        case 'trash':
            renderTrash();
            refreshBtn.classList.remove('spinning');
            return;
    }

    try {
        const res = await fetch(endpoint);
        const data = await res.json();

        let events = [];

        if (currentTab === 'all' && data.events) {
            const upcoming = data.events.upcoming || [];
            const past = data.events.past || [];
            events = [...upcoming, ...past];
        } else if (data.events) {
            events = data.events;
        }

        // Filter out trashed events from display
        const trashedIds = new Set(trashedEvents.map(e => e._id));
        events = events.filter(e => !trashedIds.has(e._id));

        renderEvents(events);
        footerStatus.textContent = `Last updated: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    } catch (err) {
        console.error('Failed to fetch events:', err);
        showEmpty('⚠️', 'Connection failed', 'Is your backend running?');
    } finally {
        refreshBtn.classList.remove('spinning');
    }
}

// ========== TRASH HELPERS ==========
function trashEvent(event) {
    trashedEvents.push(event);
    updateTrashCount();
}

function restoreEvent(event) {
    trashedEvents = trashedEvents.filter(e => e._id !== event._id);
    updateTrashCount();
}

function updateTrashCount() {
    if (trashedEvents.length > 0) {
        trashCount.textContent = trashedEvents.length;
        trashCount.classList.remove('hidden');
    } else {
        trashCount.classList.add('hidden');
    }
}

// ========== RENDER TRASH VIEW ==========
function renderTrash() {
    loading.classList.add('hidden');

    if (trashedEvents.length === 0) {
        showEmpty('🗑️', 'Trash is empty', 'Dismissed events will appear here');
        footerStatus.textContent = `${trashedEvents.length} items in trash`;
        return;
    }

    const grouped = groupByDate(trashedEvents);
    eventsList.innerHTML = '';

    for (const [dateLabel, dateEvents] of Object.entries(grouped)) {
        const group = document.createElement('div');
        group.className = 'date-group';

        const label = document.createElement('div');
        label.className = 'date-label';
        label.textContent = dateLabel;
        group.appendChild(label);

        dateEvents.forEach(event => {
            group.appendChild(createTrashCard(event));
        });

        eventsList.appendChild(group);
    }

    emptyState.classList.add('hidden');
    eventsList.classList.remove('hidden');
    footerStatus.textContent = `${trashedEvents.length} items in trash`;
}

// ========== RENDER EVENTS ==========
function renderEvents(events) {
    if (!events || events.length === 0) {
        showEmpty('🎉', 'No events found', "You're all clear!");
        return;
    }

    const grouped = groupByDate(events);
    eventsList.innerHTML = '';

    for (const [dateLabel, dateEvents] of Object.entries(grouped)) {
        const group = document.createElement('div');
        group.className = 'date-group';

        const label = document.createElement('div');
        label.className = 'date-label';
        label.textContent = dateLabel;
        group.appendChild(label);

        dateEvents.forEach(event => {
            group.appendChild(createEventCard(event));
        });

        eventsList.appendChild(group);
    }

    loading.classList.add('hidden');
    emptyState.classList.add('hidden');
    eventsList.classList.remove('hidden');
}

// ========== CREATE EVENT CARD ==========
function createEventCard(event) {
    const card = document.createElement('div');
    const priority = (event.priority || 'low');
    card.className = `event-card priority-${priority}`;

    const eventType = (event.eventType || 'OTHER').toLowerCase();
    const status = (event.eventStatus || 'pending').toLowerCase();

    let timeStr = event.time || '00:00';
    if (timeStr !== '00:00') {
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        timeStr = `${displayHour}:${m} ${ampm}`;
    } else {
        timeStr = 'All day';
    }

    card.innerHTML = `
        <button class="complete-btn" title="Mark as Completed" ${status === 'completed' ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </button>
        <button class="trash-btn" title="Dismiss">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
        <div class="priority-stripe ${priority}"></div>
        <div class="event-content" style="${status === 'completed' ? 'opacity: 0.6; text-decoration: line-through;' : ''}">
            <div class="event-title">${escapeHtml(event.title)}</div>
            <div class="event-desc">${escapeHtml(event.description || '')}</div>
            <div class="event-meta">
                <span class="event-time">${timeStr}</span>
                <span class="event-badge badge-${eventType}">${event.eventType}</span>
                <span class="status-badge status-${status}">${status}</span>
            </div>
        </div>
    `;

    // Trash = UI-only dismiss, no backend call
    const trashBtn = card.querySelector('.trash-btn');
    trashBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        trashEvent(event);
        card.style.opacity = '0';
        card.style.transform = 'translateX(30px)';
        card.style.transition = 'all 0.2s ease';
        setTimeout(() => {
            card.remove();
            if (eventsList.querySelectorAll('.event-card').length === 0) {
                showEmpty('🎉', 'All cleared', 'No events left');
            }
        }, 200);
    });

    const completeBtn = card.querySelector('.complete-btn');
    if (completeBtn && status !== 'completed') {
        completeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            completeBtn.style.pointerEvents = 'none';
            completeBtn.style.opacity = '0.5';
            
            try {
                const res = await fetch(`${API_BASE}/update/${event._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventStatus: 'COMPLETED' })
                });

                if (res.ok) {
                    // Update UI locally instead of full refresh for smooth experience
                    const content = card.querySelector('.event-content');
                    content.style.opacity = '0.6';
                    content.style.textDecoration = 'line-through';
                    
                    const statusBadge = card.querySelector('.status-badge');
                    statusBadge.className = 'status-badge status-completed';
                    statusBadge.textContent = 'completed';
                    
                    completeBtn.disabled = true;
                }
            } catch (err) {
                console.error('Failed to mark event as completed', err);
                completeBtn.style.pointerEvents = 'auto';
                completeBtn.style.opacity = '1';
            }
        });
    }

    return card;
}

// ========== CREATE TRASH CARD (with restore button) ==========
function createTrashCard(event) {
    const card = document.createElement('div');
    const priority = (event.priority || 'low');
    card.className = `event-card priority-${priority}`;
    card.style.opacity = '0.6';

    const eventType = (event.eventType || 'OTHER').toLowerCase();
    const status = (event.eventStatus || 'pending').toLowerCase();

    let timeStr = event.time || '00:00';
    if (timeStr !== '00:00') {
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        timeStr = `${displayHour}:${m} ${ampm}`;
    } else {
        timeStr = 'All day';
    }

    card.innerHTML = `
        <button class="restore-btn" title="Restore">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M3 12a9 9 0 1118 0 9 9 0 01-18 0z" stroke="currentColor" stroke-width="2"/>
                <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
        <div class="priority-stripe ${priority}"></div>
        <div class="event-content">
            <div class="event-title">${escapeHtml(event.title)}</div>
            <div class="event-desc">${escapeHtml(event.description || '')}</div>
            <div class="event-meta">
                <span class="event-time">${timeStr}</span>
                <span class="event-badge badge-${eventType}">${event.eventType}</span>
                <span class="status-badge status-${status}">${status}</span>
            </div>
        </div>
    `;

    // Restore = put back in normal view
    const restoreBtn = card.querySelector('.restore-btn');
    restoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        restoreEvent(event);
        card.style.opacity = '0';
        card.style.transform = 'translateX(-30px)';
        card.style.transition = 'all 0.2s ease';
        setTimeout(() => {
            card.remove();
            if (trashedEvents.length === 0) {
                showEmpty('🗑️', 'Trash is empty', 'Dismissed events will appear here');
            }
            footerStatus.textContent = `${trashedEvents.length} items in trash`;
        }, 200);
    });

    return card;
}

// ========== GROUP BY DATE ==========
function groupByDate(events) {
    const groups = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    events.forEach(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);

        let label;
        if (eventDate.getTime() === today.getTime()) {
            label = 'Today';
        } else if (eventDate.getTime() === tomorrow.getTime()) {
            label = 'Tomorrow';
        } else {
            label = formatDate(eventDate);
        }

        if (!groups[label]) groups[label] = [];
        groups[label].push(event);
    });

    return groups;
}

// ========== HELPERS ==========
function formatDate(date) {
    return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading() {
    loading.classList.remove('hidden');
    emptyState.classList.add('hidden');
    eventsList.classList.add('hidden');
}

function showEmpty(icon, title, sub) {
    loading.classList.add('hidden');
    eventsList.classList.add('hidden');
    emptyState.classList.remove('hidden');
    emptyState.innerHTML = `
        <span class="empty-icon">${icon}</span>
        <p>${title}</p>
        <span class="empty-sub">${sub}</span>
    `;
}

// ========== INIT ==========
fetchEvents();
