const Priority = { low: 0, medium: 1, high: 2 };
const FilterType = { all: 'all', active: 'active', completed: 'completed' };

let tasks = {};
let notes = [];
let activities = [];
let currentTab = 'dashboard';
let filter = FilterType.all;
let searchQuery = '';
let editingTask = null;
let editingNote = null;
let deletedTask = null;
let selectedDueDate = null;
let selectedTime = null;
let datePickerViewDate = new Date();

function generateId() {
  return Date.now().toString();
}

function loadTasks() {
  const data = localStorage.getItem('tasks');
  if (data) {
    try {
      const parsed = JSON.parse(data);
      tasks = {};
      parsed.forEach(task => {
        tasks[task.id] = {
          ...task,
          createdAt: new Date(task.createdAt),
          dueDate: task.dueDate ? new Date(task.dueDate) : null
        };
      });
    } catch (e) {
      console.error('Error loading tasks:', e);
    }
  }
}

function saveTasks() {
  const tasksList = Object.values(tasks).map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    dueDate: t.dueDate ? t.dueDate.toISOString() : null
  }));
  localStorage.setItem('tasks', JSON.stringify(tasksList));
}

function loadNotes() {
  const data = localStorage.getItem('notes');
  if (data) {
    try {
      const parsed = JSON.parse(data);
      notes = parsed.map(n => ({
        ...n,
        createdAt: new Date(n.createdAt),
        updatedAt: new Date(n.updatedAt)
      }));
      sortNotes();
    } catch (e) {
      console.error('Error loading notes:', e);
    }
  }
}

function saveNotes() {
  const notesData = notes.map(n => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString()
  }));
  localStorage.setItem('notes', JSON.stringify(notesData));
}

function loadActivities() {
  const data = localStorage.getItem('activities');
  if (data) {
    try {
      const parsed = JSON.parse(data);
      activities = parsed.map(a => {
        const activity = {
          ...a,
          timestamp: new Date(a.timestamp)
        };
        if (a.originalData) {
          activity.originalData = {
            ...a.originalData,
            createdAt: a.originalData.createdAt && !isNaN(new Date(a.originalData.createdAt)) ? new Date(a.originalData.createdAt) : null,
            updatedAt: a.originalData.updatedAt && !isNaN(new Date(a.originalData.updatedAt)) ? new Date(a.originalData.updatedAt) : null,
            dueDate: a.originalData.dueDate && !isNaN(new Date(a.originalData.dueDate)) ? new Date(a.originalData.dueDate) : null
          };
        }
        if (a.newData) {
          activity.newData = {
            ...a.newData,
            createdAt: a.newData.createdAt && !isNaN(new Date(a.newData.createdAt)) ? new Date(a.newData.createdAt) : null,
            updatedAt: a.newData.updatedAt && !isNaN(new Date(a.newData.updatedAt)) ? new Date(a.newData.updatedAt) : null,
            dueDate: a.newData.dueDate && !isNaN(new Date(a.newData.dueDate)) ? new Date(a.newData.dueDate) : null
          };
        }
        return activity;
      });
    } catch (e) {
      console.error('Error loading activities:', e);
    }
  }
}

function saveActivities() {
  const activitiesData = activities.map(a => {
    const data = {
      ...a,
      timestamp: a.timestamp.toISOString()
    };
    if (a.originalData) {
      data.originalData = {
        ...a.originalData,
        createdAt: (a.originalData.createdAt instanceof Date && !isNaN(a.originalData.createdAt)) ? a.originalData.createdAt.toISOString() : null,
        updatedAt: (a.originalData.updatedAt instanceof Date && !isNaN(a.originalData.updatedAt)) ? a.originalData.updatedAt.toISOString() : null,
        dueDate: (a.originalData.dueDate instanceof Date && !isNaN(a.originalData.dueDate)) ? a.originalData.dueDate.toISOString() : null
      };
    }
    if (a.newData) {
      data.newData = {
        ...a.newData,
        createdAt: (a.newData.createdAt instanceof Date && !isNaN(a.newData.createdAt)) ? a.newData.createdAt.toISOString() : null,
        updatedAt: (a.newData.updatedAt instanceof Date && !isNaN(a.newData.updatedAt)) ? a.newData.updatedAt.toISOString() : null,
        dueDate: (a.newData.dueDate instanceof Date && !isNaN(a.newData.dueDate)) ? a.newData.dueDate.toISOString() : null
      };
    }
    return data;
  });
  localStorage.setItem('activities', JSON.stringify(activitiesData));
}

function logActivity(type, title, itemType, originalData = null, newData = null) {
  const activity = {
    id: generateId(),
    type,
    title,
    itemType,
    originalData,
    newData,
    timestamp: new Date()
  };
  activities.unshift(activity);
  if (activities.length > 100) {
    activities = activities.slice(0, 100);
  }
  saveActivities();
  if (currentTab === 'activity') {
    renderActivity();
  }
}

function sortNotes() {
  notes.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

function getFilteredTasks() {
  let tasksList = Object.values(tasks);

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    tasksList = tasksList.filter(t => 
      t.title.toLowerCase().includes(query) || 
      (t.description && t.description.toLowerCase().includes(query))
    );
  }

  if (filter === FilterType.active) {
    tasksList = tasksList.filter(t => !t.isCompleted);
  } else if (filter === FilterType.completed) {
    tasksList = tasksList.filter(t => t.isCompleted);
  }

  tasksList.sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.createdAt - a.createdAt;
  });

  return tasksList;
}

function getFilteredNotes() {
  let notesList = notes;
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    notesList = notes.filter(n => 
      n.title.toLowerCase().includes(query) || 
      n.content.toLowerCase().includes(query)
    );
  }
  return notesList;
}

function renderStats() {
  const allTasks = Object.values(tasks);
  const total = allTasks.length;
  const completed = allTasks.filter(t => t.isCompleted).length;
  const active = total - completed;

  document.getElementById('total-count').textContent = total;
  document.getElementById('active-count').textContent = active;
  document.getElementById('done-count').textContent = completed;

  // Dashboard stats
  document.getElementById('dash-total').textContent = total;
  document.getElementById('dash-unfinished').textContent = active;
  document.getElementById('dash-finished').textContent = completed;
  document.getElementById('dash-notes').textContent = notes.length;
}

function renderDashboard() {
  renderStats();

  // Recent tasks (last 5)
  const recentTasks = Object.values(tasks)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  const tasksContainer = document.getElementById('dash-recent-tasks');
  if (recentTasks.length === 0) {
    tasksContainer.innerHTML = '<p class="text-gray-400 text-center py-4">No tasks yet</p>';
  } else {
    tasksContainer.innerHTML = recentTasks.map(task => `
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <input type="checkbox" ${task.isCompleted ? 'checked' : ''} 
          class="w-4 h-4 rounded border-gray-300 text-purple-600 dash-toggle-task" data-id="${task.id}">
        <div class="flex-1 min-w-0">
          <p class="font-medium ${task.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'} truncate">${escapeHtml(task.title)}</p>
        </div>
        ${renderPriorityBadge(task.priority)}
      </div>
    `).join('');

    document.querySelectorAll('.dash-toggle-task').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        toggleTaskComplete(id);
        renderDashboard();
      });
    });
  }

  // Recent notes (last 5)
  const recentNotes = notes.slice(0, 5);
  const notesContainer = document.getElementById('dash-recent-notes');
  if (recentNotes.length === 0) {
    notesContainer.innerHTML = '<p class="text-gray-400 text-center py-4">No notes yet</p>';
  } else {
    notesContainer.innerHTML = recentNotes.map(note => `
      <div class="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition" onclick="switchTab('notes')">
        <p class="font-medium text-gray-800 truncate">${escapeHtml(note.title)}</p>
        <p class="text-xs text-gray-400 mt-1">${formatDate(note.updatedAt)}</p>
      </div>
    `).join('');
  }
}

let currentWeatherData = null;
let currentLocationName = "Your Location";

function updateDashboardWeather(data, locationName) {
  currentWeatherData = data;
  currentLocationName = locationName;

  if (data) {
    const info = getWeatherInfo(data.weathercode);
    document.getElementById('weather-temp-dashboard').textContent = `${Math.round(data.temperature)}°C`;
    document.getElementById('weather-desc-dashboard').textContent = info.desc;
    document.getElementById('weather-icon-dashboard').className = `fas ${info.icon} text-5xl ${info.color}`;
  }
  document.getElementById('weather-location-dashboard').textContent = locationName;
}

function renderTasks() {
  const container = document.getElementById('todos-panel');
  const filteredTasks = getFilteredTasks();

  if (filteredTasks.length === 0) {
    showEmptyState(searchQuery ? `No tasks found matching "${searchQuery}"` : 
      (filter === FilterType.completed ? 'No completed tasks' : 
       filter === FilterType.active ? 'No active tasks' : 'No tasks yet. Click + to add one!'));
    return;
  }

  hideEmptyState();
  container.classList.remove('hidden');
  document.getElementById('notes-panel').classList.add('hidden');

  container.innerHTML = filteredTasks.map(task => `
    <div class="task-card bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-4 hover:shadow-md transition group">
      <input type="checkbox" ${task.isCompleted ? 'checked' : ''} 
        class="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer toggle-task" data-id="${task.id}">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <h3 class="font-semibold ${task.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}">${escapeHtml(task.title)}</h3>
          ${renderPriorityBadge(task.priority)}
        </div>
        ${task.description ? `<p class="text-sm text-gray-500 mt-1">${escapeHtml(task.description)}</p>` : ''}
        <div class="flex items-center gap-3 mt-2 text-xs text-gray-400">
          ${task.dueDate ? renderDueDateBadge(task.dueDate) : ''}
          ${task.category ? renderCategoryBadge(task.category) : ''}
          <span class="text-xs">${formatDate(task.createdAt)}</span>
        </div>
      </div>
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <button class="edit-task p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-purple-600" data-id="${task.id}" title="Edit">
          <i class="fas fa-edit"></i>
        </button>
        <button class="delete-task p-2 hover:bg-red-50 text-gray-400 hover:text-red-600" data-id="${task.id}" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');

  attachTaskListeners();
}

function renderPriorityBadge(priority) {
  const colors = { 0: 'bg-gray-100 text-gray-500', 1: 'bg-orange-100 text-orange-600', 2: 'bg-red-100 text-red-600' };
  const labels = { 0: 'Low', 1: 'Medium', 2: 'High' };
  return `<span class="px-2 py-0.5 rounded text-xs font-medium ${colors[priority]}">${labels[priority]}</span>`;
}

function renderDueDateBadge(dueDate) {
  const now = new Date();
  const due = new Date(dueDate);
  const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const isOverdue = due < now && !isSameDay(due, now);
  const isToday = isSameDay(due, now);

  let color = 'text-blue-500';
  if (isOverdue) color = 'text-red-500';
  else if (isToday) color = 'text-orange-500';

  const text = isToday ? 'Today' : `${due.getDate()}/${due.getMonth() + 1}`;

  return `<span class="${color}"><i class="fas fa-calendar-alt mr-1"></i>${text}</span>`;
}

function renderCategoryBadge(category) {
  return `<span class="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-600">${escapeHtml(category)}</span>`;
}

function renderNotes() {
  const container = document.getElementById('notes-panel');
  const filteredNotes = getFilteredNotes();

  if (filteredNotes.length === 0) {
    showEmptyState(searchQuery ? 'No notes found' : 'No notes yet. Click + to add one!');
    return;
  }

  hideEmptyState();
  container.classList.remove('hidden');
  document.getElementById('todos-panel').classList.add('hidden');

  container.innerHTML = filteredNotes.map(note => `
    <div class="note-card bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md transition group ${note.isPinned ? 'ring-2 ring-purple-200' : ''}" data-id="${note.id}">
      <div class="flex items-start justify-between mb-2">
        <h3 class="font-bold text-gray-800 ${!note.title ? 'italic text-gray-400' : ''}">${note.title || 'Untitled'}</h3>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button class="note-pin p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-purple-600" data-id="${note.id}" title="${note.isPinned ? 'Unpin' : 'Pin'}">
            <i class="fas fa-thumbtack"></i>
          </button>
          <button class="note-delete p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600" data-id="${note.id}" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      ${note.content ? `<p class="text-sm text-gray-500 mt-2 line-clamp-4">${escapeHtml(note.content)}</p>` : ''}
      <p class="text-xs text-gray-400 mt-3">${formatDate(note.updatedAt)}</p>
    </div>
  `).join('');

  attachNoteListeners();
}

function renderActivity() {
  const container = document.getElementById('activity-list');
  
  if (activities.length === 0) {
    showEmptyState('No activity yet');
    return;
  }

  hideEmptyState();
  document.getElementById('todos-panel').classList.add('hidden');
  document.getElementById('notes-panel').classList.add('hidden');
  document.getElementById('activity-panel').classList.remove('hidden');

  container.innerHTML = activities.map(activity => {
    const iconInfo = getActivityIcon(activity.type);
    return `
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
        <div class="w-10 h-10 rounded-full ${iconInfo.bg} flex items-center justify-center">
          <i class="fas ${iconInfo.icon} ${iconInfo.color}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-gray-800">${iconInfo.text} <span class="font-semibold">${escapeHtml(activity.title)}</span></p>
          <p class="text-xs text-gray-400 mt-1">${formatDate(activity.timestamp)}</p>
        </div>
        ${activity.originalData ? `
          <button class="view-btn p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-purple-600" data-id="${activity.id}" title="View Details">
            <i class="fas fa-eye"></i>
          </button>
        ` : ''}
        ${activity.type === 'deleted' || activity.type === 'note-deleted' ? `
          <button class="restore-btn px-3 py-1.5 bg-purple-100 text-purple-600 rounded-lg text-sm hover:bg-purple-200" data-id="${activity.id}" data-item-id="${activity.itemId}">
            <i class="fas fa-undo mr-1"></i> Restore
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  attachActivityListeners();
}

function getActivityIcon(type) {
  const icons = {
    'created': { icon: 'fa-plus', bg: 'bg-green-100', color: 'text-green-600', text: 'Created' },
    'edited': { icon: 'fa-edit', bg: 'bg-blue-100', color: 'text-blue-600', text: 'Edited' },
    'deleted': { icon: 'fa-trash', bg: 'bg-red-100', color: 'text-red-600', text: 'Deleted' },
    'completed': { icon: 'fa-check', bg: 'bg-blue-100', color: 'text-blue-600', text: 'Completed' },
    'uncompleted': { icon: 'fa-check', bg: 'bg-gray-100', color: 'text-gray-600', text: 'Marked incomplete' },
    'restored': { icon: 'fa-undo', bg: 'bg-purple-100', color: 'text-purple-600', text: 'Restored' },
    'note-created': { icon: 'fa-plus', bg: 'bg-green-100', color: 'text-green-600', text: 'Created note' },
    'note-deleted': { icon: 'fa-trash', bg: 'bg-red-100', color: 'text-red-600', text: 'Deleted note' },
    'note-updated': { icon: 'fa-edit', bg: 'bg-orange-100', color: 'text-orange-600', text: 'Updated note' }
  };
  return icons[type] || { icon: 'fa-circle', bg: 'bg-gray-100', color: 'text-gray-600', text: 'Activity' };
}

function attachActivityListeners() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const activity = activities.find(a => a.id === btn.dataset.id);
      if (activity && activity.originalData) {
        showActivityDetails(activity);
      }
    });
  });

  document.querySelectorAll('.restore-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemId = btn.dataset.itemId;
      restoreTask(itemId, btn.dataset.id);
    });
  });
}

function showActivityDetails(activity) {
  let details = '';
  
  if (activity.type === 'edited' || activity.type === 'note-updated') {
    const oldData = activity.originalData;
    const newData = activity.newData;
    
    if (activity.itemType === 'task') {
      details = `
        <div class="space-y-3">
          <div class="pb-2 border-b border-gray-200">
            <h4 class="font-semibold text-gray-800">Before</h4>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg space-y-2">
            ${oldData.title !== newData.title ? `<div class="flex items-center gap-2"><span class="text-gray-500 text-sm">Title:</span> <span class="font-medium line-through text-red-500">${escapeHtml(oldData.title)}</span> <i class="fas fa-arrow-right text-gray-400"></i> <span class="font-medium text-green-600">${escapeHtml(newData.title)}</span></div>` : `<div><span class="text-gray-500 text-sm">Title:</span> <span class="font-medium">${escapeHtml(oldData.title)}</span></div>`}
            ${oldData.description !== newData.description ? `<div class="flex items-center gap-2"><span class="text-gray-500 text-sm">Description:</span> <span class="font-medium text-red-500">${escapeHtml(oldData.description || 'None')}</span> <i class="fas fa-arrow-right text-gray-400"></i> <span class="font-medium text-green-600">${escapeHtml(newData.description || 'None')}</span></div>` : ''}
            ${oldData.category !== newData.category ? `<div class="flex items-center gap-2"><span class="text-gray-500 text-sm">Category:</span> <span class="font-medium text-red-500">${oldData.category || 'None'}</span> <i class="fas fa-arrow-right text-gray-400"></i> <span class="font-medium text-green-600">${newData.category || 'None'}</span></div>` : ''}
            ${oldData.priority !== newData.priority ? `<div class="flex items-center gap-2"><span class="text-gray-500 text-sm">Priority:</span> <span class="font-medium text-red-500">${['Low', 'Medium', 'High'][oldData.priority]}</span> <i class="fas fa-arrow-right text-gray-400"></i> <span class="font-medium text-green-600">${['Low', 'Medium', 'High'][newData.priority]}</span></div>` : ''}
            ${(oldData.isCompleted !== newData.isCompleted) ? `<div class="flex items-center gap-2"><span class="text-gray-500 text-sm">Status:</span> <span class="font-medium text-red-500">${oldData.isCompleted ? 'Completed' : 'Active'}</span> <i class="fas fa-arrow-right text-gray-400"></i> <span class="font-medium text-green-600">${newData.isCompleted ? 'Completed' : 'Active'}</span></div>` : ''}
            ${(oldData.dueDate ? oldData.dueDate.toISOString() : null) !== (newData.dueDate ? newData.dueDate.toISOString() : null) ? `<div class="flex items-center gap-2"><span class="text-gray-500 text-sm">Due Date:</span> <span class="font-medium text-red-500">${oldData.dueDate ? formatDateDisplay(new Date(oldData.dueDate)) : 'None'}</span> <i class="fas fa-arrow-right text-gray-400"></i> <span class="font-medium text-green-600">${newData.dueDate ? formatDateDisplay(new Date(newData.dueDate)) : 'None'}</span></div>` : ''}
          </div>
        </div>
      `;
    } else if (activity.itemType === 'note') {
      details = `
        <div class="space-y-3">
          <div class="pb-2 border-b border-gray-200">
            <h4 class="font-semibold text-gray-800">Before</h4>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg space-y-2">
            ${oldData.title !== newData.title ? `<div class="flex items-center gap-2"><span class="text-gray-500 text-sm">Title:</span> <span class="font-medium line-through text-red-500">${escapeHtml(oldData.title)}</span> <i class="fas fa-arrow-right text-gray-400"></i> <span class="font-medium text-green-600">${escapeHtml(newData.title)}</span></div>` : `<div><span class="text-gray-500 text-sm">Title:</span> <span class="font-medium">${escapeHtml(oldData.title)}</span></div>`}
            ${oldData.content !== newData.content ? `<div><span class="text-gray-500 text-sm">Content:</span></div><div class="bg-white p-2 rounded border border-gray-200 text-sm">${escapeHtml(oldData.content || 'Empty')}</div><div class="text-center text-gray-400 py-1"><i class="fas fa-arrow-down"></i></div><div class="bg-white p-2 rounded border border-gray-200 text-sm">${escapeHtml(newData.content || 'Empty')}</div>` : ''}
          </div>
        </div>
      `;
    }
  } else {
    const data = activity.originalData;
    if (activity.itemType === 'task') {
      details = `
        <div class="space-y-3">
          <div><span class="text-gray-500">Title:</span> <span class="font-medium">${escapeHtml(data.title)}</span></div>
          ${data.description ? `<div><span class="text-gray-500">Description:</span> <span class="font-medium">${escapeHtml(data.description)}</span></div>` : ''}
          ${data.category ? `<div><span class="text-gray-500">Category:</span> <span class="font-medium">${escapeHtml(data.category)}</span></div>` : ''}
          <div><span class="text-gray-500">Priority:</span> <span class="font-medium">${['Low', 'Medium', 'High'][data.priority]}</span></div>
          <div><span class="text-gray-500">Status:</span> <span class="font-medium">${data.isCompleted ? 'Completed' : 'Active'}</span></div>
          ${data.dueDate ? `<div><span class="text-gray-500">Due Date:</span> <span class="font-medium">${formatDateDisplay(new Date(data.dueDate))}</span></div>` : ''}
        </div>
      `;
    } else if (activity.itemType === 'note') {
      details = `
        <div class="space-y-3">
          <div><span class="text-gray-500">Title:</span> <span class="font-medium">${escapeHtml(data.title)}</span></div>
          ${data.content ? `<div><span class="text-gray-500">Content:</span></div><div class="bg-gray-50 p-3 rounded-lg text-sm">${escapeHtml(data.content)}</div>` : ''}
        </div>
      `;
    }
  }

  document.getElementById('activity-detail-content').innerHTML = details;
  document.getElementById('activity-modal').classList.remove('hidden');
}

function closeActivityModal() {
  document.getElementById('activity-modal').classList.add('hidden');
}

function restoreTask(itemId, activityId) {
  const deletedActivity = activities.find(a => a.id === activityId);
  if (deletedActivity && deletedActivity.originalData) {
    const data = { ...deletedActivity.originalData };
    if (data.createdAt) data.createdAt = new Date(data.createdAt);
    if (data.updatedAt) data.updatedAt = new Date(data.updatedAt);
    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    
    if (deletedActivity.itemType === 'task') {
      tasks[data.id] = data;
      saveTasks();
      renderTasks();
      renderStats();
    } else if (deletedActivity.itemType === 'note') {
      notes.push(data);
      sortNotes();
      saveNotes();
      renderNotes();
    }
    logActivity('restored', deletedActivity.title, deletedActivity.itemType);
    activities = activities.filter(a => a.id !== activityId);
    saveActivities();
    renderActivity();
    showToast(`"${deletedActivity.title}" restored`);
  }
}

function formatDate(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatDateDisplay(date, time) {
  if (!date) return 'No date';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  let dateStr = '';
  if (dateOnly.getTime() === today.getTime()) dateStr = 'Today';
  else if (dateOnly.getTime() === tomorrow.getTime()) dateStr = 'Tomorrow';
  else {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    dateStr = date.toLocaleDateString('en-US', options);
  }
  
  if (time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${dateStr}, ${hour12}:${minutes} ${ampm}`;
  }
  return dateStr;
}

function renderCalendar() {
  const year = datePickerViewDate.getFullYear();
  const month = datePickerViewDate.getMonth();
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  document.getElementById('current-month').textContent = `${monthNames[month]} ${year}`;
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let html = '';
  
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="h-8"></div>';
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    currentDate.setHours(0, 0, 0, 0);
    
    let classes = 'h-8 w-8 flex items-center justify-center text-sm rounded-full cursor-pointer hover:bg-purple-100 ';
    
    if (currentDate.getTime() === today.getTime()) {
      classes += 'bg-purple-600 text-white hover:bg-purple-700 ';
    } else if (selectedDueDate) {
      const selected = new Date(selectedDueDate);
      selected.setHours(0, 0, 0, 0);
      if (currentDate.getTime() === selected.getTime()) {
        classes += 'bg-purple-200 text-purple-700 font-semibold ';
      } else {
        classes += 'text-gray-700 ';
      }
    } else {
      classes += 'text-gray-700 ';
    }
    
    const isPast = currentDate < today;
    if (isPast) {
      classes = 'h-8 w-8 flex items-center justify-center text-sm text-gray-300 cursor-not-allowed ';
    }
    
    html += `<div class="${classes}" data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}">${day}</div>`;
  }
  
  document.getElementById('calendar-days').innerHTML = html;
  
  document.querySelectorAll('#calendar-days [data-date]').forEach(el => {
    el.addEventListener('click', () => {
      const dateStr = el.dataset.date;
      if (el.classList.contains('cursor-not-allowed')) return;
      selectedDueDate = new Date(dateStr + 'T12:00:00');
      if (!selectedTime) selectedTime = '12:00';
      document.getElementById('task-time').value = selectedTime;
      document.getElementById('date-picker-display').textContent = formatDateDisplay(selectedDueDate, selectedTime);
      renderCalendar();
    });
  });
}

function toggleDatePicker(show) {
  const picker = document.getElementById('date-picker');
  if (show) {
    datePickerViewDate = selectedDueDate ? new Date(selectedDueDate) : new Date();
    renderCalendar();
    picker.classList.remove('hidden');
  } else {
    picker.classList.add('hidden');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showEmptyState(message) {
  document.getElementById('todos-panel').classList.add('hidden');
  document.getElementById('notes-panel').classList.add('hidden');
  document.getElementById('empty-state').classList.remove('hidden');
  document.getElementById('empty-message').textContent = message;
}

function hideEmptyState() {
  document.getElementById('empty-state').classList.add('hidden');
}

function attachTaskListeners() {
  document.querySelectorAll('.toggle-task').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      const id = e.target.dataset.id;
      toggleTaskComplete(id);
    });
  });

  document.querySelectorAll('.edit-task').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      openTaskModal(tasks[id]);
    });
  });

  document.querySelectorAll('.delete-task').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      deleteTask(id);
    });
  });
}

function attachNoteListeners() {
  document.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.note-pin') && !e.target.closest('.note-delete')) {
        const id = card.dataset.id;
        openNoteModal(notes.find(n => n.id === id));
      }
    });
  });

  document.querySelectorAll('.note-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      deleteNote(id);
    });
  });

  document.querySelectorAll('.note-pin').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      toggleNotePin(id);
    });
  });
}

function toggleTaskComplete(id) {
  const task = tasks[id];
  if (task) {
    const wasCompleted = task.isCompleted;
    task.isCompleted = !task.isCompleted;
    saveTasks();
    logActivity(wasCompleted ? 'uncompleted' : 'completed', task.title, 'task');
    renderTasks();
    renderStats();
  }
}

function deleteTask(id) {
  deletedTask = tasks[id];
  delete tasks[id];
  saveTasks();
  const taskData = { ...deletedTask };
  if (taskData.createdAt) taskData.createdAt = new Date(taskData.createdAt);
  if (taskData.dueDate) taskData.dueDate = new Date(taskData.dueDate);
  
  const activity = {
    id: generateId(),
    type: 'deleted',
    title: deletedTask.title,
    itemType: 'task',
    itemId: deletedTask.id,
    originalData: taskData,
    timestamp: new Date()
  };
  activities.unshift(activity);
  if (activities.length > 100) {
    activities = activities.slice(0, 100);
  }
  saveActivities();
  renderTasks();
  renderStats();
  showToast(`"${deletedTask.title}" deleted`, true);
}

function deleteNote(id) {
  const deletedNote = notes.find(n => n.id === id);
  if (deletedNote) {
    const noteData = { ...deletedNote };
    if (noteData.createdAt) noteData.createdAt = new Date(noteData.createdAt);
    if (noteData.updatedAt) noteData.updatedAt = new Date(noteData.updatedAt);
    
    const activity = {
      id: generateId(),
      type: 'note-deleted',
      title: deletedNote.title,
      itemType: 'note',
      itemId: deletedNote.id,
      originalData: noteData,
      timestamp: new Date()
    };
    activities.unshift(activity);
    if (activities.length > 100) {
      activities = activities.slice(0, 100);
    }
    saveActivities();
  }
  notes = notes.filter(n => n.id !== id);
  saveNotes();
  renderNotes();
  showToast('Note deleted');
}

function toggleNotePin(id) {
  const note = notes.find(n => n.id === id);
  if (note) {
    note.isPinned = !note.isPinned;
    sortNotes();
    saveNotes();
    renderNotes();
  }
}

function openTaskModal(task = null) {
  editingTask = task;
  const title = document.getElementById('task-modal-title');
  const titleInput = document.getElementById('task-title');
  const descInput = document.getElementById('task-description');
  const catInput = document.getElementById('task-category');
  const saveBtn = document.getElementById('save-task');

  title.textContent = task ? 'Edit Task' : 'Add Task';
  titleInput.value = task ? task.title : '';
  descInput.value = task ? (task.description || '') : '';
  catInput.value = task ? (task.category || '') : '';

  selectedDueDate = task && task.dueDate ? new Date(task.dueDate) : null;
  selectedTime = task && task.dueDate ? 
    `${String(new Date(task.dueDate).getHours()).padStart(2, '0')}:${String(new Date(task.dueDate).getMinutes()).padStart(2, '0')}` : 
    null;
  document.getElementById('task-time').value = selectedTime || '';
  document.getElementById('date-picker-display').textContent = formatDateDisplay(selectedDueDate, selectedTime);
  datePickerViewDate = selectedDueDate ? new Date(selectedDueDate) : new Date();
  renderCalendar();

  document.querySelectorAll('.priority-btn').forEach(btn => {
    const p = parseInt(btn.dataset.priority);
    const taskP = task ? task.priority : 1;
    if (p === taskP) {
      btn.classList.add('bg-orange-100', 'border-orange-300', 'text-orange-700');
      btn.classList.remove('border-gray-300', 'text-gray-600');
    } else {
      btn.classList.remove('bg-orange-100', 'border-orange-300', 'text-orange-700');
      btn.classList.add('border-gray-300', 'text-gray-600');
    }
  });

  saveBtn.textContent = task ? 'Update Task' : 'Add Task';
  document.getElementById('task-modal').classList.remove('hidden');
  titleInput.focus();
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.add('hidden');
  document.getElementById('date-picker').classList.add('hidden');
  editingTask = null;
}

function saveTask() {
  const titleInput = document.getElementById('task-title');
  const descInput = document.getElementById('task-description');
  const catInput = document.getElementById('task-category');

  const title = titleInput.value.trim();
  if (!title) {
    showToast('Please enter a title');
    return;
  }

  let priority = 1;
  document.querySelectorAll('.priority-btn').forEach(btn => {
    if (btn.classList.contains('bg-orange-100')) {
      priority = parseInt(btn.dataset.priority);
    }
  });

  let dueDate = selectedDueDate;
  if (dueDate && selectedTime) {
    const [hours, minutes] = selectedTime.split(':');
    dueDate = new Date(dueDate);
    dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  }

  if (editingTask) {
    const originalData = { ...tasks[editingTask.id] };
    if (originalData.createdAt) originalData.createdAt = new Date(originalData.createdAt);
    if (originalData.dueDate) originalData.dueDate = new Date(originalData.dueDate);
    
    editingTask.title = title;
    editingTask.description = descInput.value.trim() || null;
    editingTask.category = catInput.value.trim() || null;
    editingTask.priority = priority;
    editingTask.dueDate = dueDate;
    tasks[editingTask.id] = editingTask;
    logActivity('edited', editingTask.title, 'task', originalData, editingTask);
  } else {
    const task = {
      id: generateId(),
      title,
      description: descInput.value.trim() || null,
      isCompleted: false,
      createdAt: new Date(),
      dueDate,
      priority,
      category: catInput.value.trim() || null
    };
    tasks[task.id] = task;
    logActivity('created', task.title, 'task');
  }

  saveTasks();
  closeTaskModal();
  renderTasks();
  renderStats();
}

function openNoteModal(note = null) {
  editingNote = note;
  const title = document.getElementById('note-modal-title');
  const titleInput = document.getElementById('note-title');
  const contentInput = document.getElementById('note-content');
  const pinBtn = document.getElementById('note-pin-btn');
  const deleteBtn = document.getElementById('note-delete-btn');

  title.textContent = note ? 'Edit Note' : 'New Note';
  titleInput.value = note ? note.title : '';
  contentInput.value = note ? note.content : '';

  pinBtn.classList.toggle('hidden', !note);
  deleteBtn.classList.toggle('hidden', !note);

  if (note) {
    pinBtn.innerHTML = `<i class="fas fa-thumbtack ${note.isPinned ? 'text-purple-600' : 'text-gray-600'}"></i>`;
  }

  document.getElementById('note-modal').classList.remove('hidden');
  titleInput.focus();
}

function closeNoteModal() {
  document.getElementById('note-modal').classList.add('hidden');
  editingNote = null;
}

function saveNote() {
  const titleInput = document.getElementById('note-title');
  const contentInput = document.getElementById('note-content');

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title && !content) {
    showToast('Please add a title or content');
    return;
  }

  const now = new Date();

  if (editingNote) {
    const originalData = { ...notes.find(n => n.id === editingNote.id) };
    if (originalData.createdAt) originalData.createdAt = new Date(originalData.createdAt);
    if (originalData.updatedAt) originalData.updatedAt = new Date(originalData.updatedAt);
    
    editingNote.title = title || 'Untitled';
    editingNote.content = content;
    editingNote.updatedAt = now;
    const index = notes.findIndex(n => n.id === editingNote.id);
    if (index !== -1) {
      notes[index] = editingNote;
    }
    logActivity('note-updated', title || 'Untitled', 'note', originalData, editingNote);
  } else {
    const note = {
      id: generateId(),
      title: title || 'Untitled',
      content,
      createdAt: now,
      updatedAt: now,
      isPinned: false
    };
    notes.push(note);
    logActivity('note-created', note.title, 'note');
  }

  sortNotes();
  saveNotes();
  closeNoteModal();
  renderNotes();
}

function showToast(message, showUndo = false) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  const undoBtn = document.getElementById('toast-undo');

  msgEl.textContent = message;
  undoBtn.classList.toggle('hidden', !showUndo);

  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);

  if (showUndo && deletedTask) {
    undoBtn.classList.remove('hidden');
    undoBtn.onclick = () => {
      tasks[deletedTask.id] = deletedTask;
      saveTasks();
      renderTasks();
      renderStats();
      deletedTask = null;
      toast.classList.add('hidden');
    };
  }
}

function switchTab(tab) {
  currentTab = tab;
  
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('text-purple-600', isActive);
    btn.classList.toggle('bg-purple-50', isActive);
    btn.classList.toggle('text-gray-600', !isActive);
    btn.classList.toggle('hover:bg-gray-50', !isActive);
  });

  const titles = {
    'dashboard': 'Dashboard',
    'todos': 'Todos',
    'notes': 'Notes',
    'activity': 'Activity',
    'weather': 'Weather',
    'maps': 'Maps'
  };
  document.getElementById('page-title').textContent = titles[tab];
  
  // Hide/Show elements based on tab
  document.getElementById('filter-container').classList.toggle('hidden', tab !== 'todos');
  document.getElementById('stats-panel').classList.toggle('hidden', tab !== 'todos');
  document.getElementById('search-bar-container').classList.toggle('hidden', tab === 'weather' || tab === 'maps' || tab === 'dashboard' || tab === 'activity');
  document.getElementById('fab').classList.toggle('hidden', tab === 'weather' || tab === 'maps' || tab === 'dashboard' || tab === 'activity');

  // Hide all panels
  document.getElementById('dashboard-panel').classList.add('hidden');
  document.getElementById('todos-panel').classList.add('hidden');
  document.getElementById('notes-panel').classList.add('hidden');
  document.getElementById('activity-panel').classList.add('hidden');
  document.getElementById('weather-panel').classList.add('hidden');
  document.getElementById('maps-panel').classList.add('hidden');
  hideEmptyState();

  searchQuery = '';
  document.getElementById('search-input').value = '';
  document.getElementById('clear-search').classList.add('hidden');

  if (tab === 'dashboard') {
    document.getElementById('dashboard-panel').classList.remove('hidden');
    renderDashboard();
  } else if (tab === 'todos') {
    renderTasks();
  } else if (tab === 'notes') {
    renderNotes();
  } else if (tab === 'activity') {
    document.getElementById('activity-panel').classList.remove('hidden');
    renderActivity();
  } else if (tab === 'weather') {
    document.getElementById('weather-panel').classList.remove('hidden');
  } else if (tab === 'maps') {
    document.getElementById('maps-panel').classList.remove('hidden');
  }
}

function setupEventListeners() {
  const addListener = (id, event, callback) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, callback);
  };

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  addListener('fab', 'click', () => {
    if (currentTab === 'todos') {
      openTaskModal();
    } else {
      openNoteModal();
    }
  });

  addListener('filter-btn', 'click', () => {
    const menu = document.getElementById('filter-menu');
    if (menu) menu.classList.toggle('hidden');
  });

  document.querySelectorAll('.filter-option').forEach(btn => {
    btn.addEventListener('click', () => {
      filter = btn.dataset.filter;
      const menu = document.getElementById('filter-menu');
      if (menu) menu.classList.add('hidden');
      renderTasks();
    });
  });

  addListener('search-input', 'input', (e) => {
    searchQuery = e.target.value;
    const clearBtn = document.getElementById('clear-search');
    if (clearBtn) clearBtn.classList.toggle('hidden', !searchQuery);
    if (currentTab === 'todos') {
      renderTasks();
    } else {
      renderNotes();
    }
  });

  addListener('clear-search', 'click', () => {
    searchQuery = '';
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clear-search');
    if (clearBtn) clearBtn.classList.add('hidden');
    if (currentTab === 'todos') {
      renderTasks();
    } else {
      renderNotes();
    }
  });

  addListener('close-task-modal', 'click', closeTaskModal);
  addListener('task-modal', 'click', (e) => {
    if (e.target.id === 'task-modal') closeTaskModal();
  });

  addListener('save-task', 'click', saveTask);

  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.priority-btn').forEach(b => {
        b.classList.remove('bg-orange-100', 'border-orange-300', 'text-orange-700');
        b.classList.add('border-gray-300', 'text-gray-600');
      });
      btn.classList.add('bg-orange-100', 'border-orange-300', 'text-orange-700');
      btn.classList.remove('border-gray-300', 'text-gray-600');
    });
  });

  addListener('clear-date', 'click', () => {
    selectedDueDate = null;
    selectedTime = null;
    const timeInput = document.getElementById('task-time');
    if (timeInput) timeInput.value = '';
    const display = document.getElementById('date-picker-display');
    if (display) display.textContent = 'No date';
    renderCalendar();
  });

  addListener('date-picker-trigger', 'click', (e) => {
    e.stopPropagation();
    toggleDatePicker(true);
  });

  addListener('close-date-picker', 'click', () => {
    toggleDatePicker(false);
  });

  addListener('prev-month', 'click', () => {
    datePickerViewDate.setMonth(datePickerViewDate.getMonth() - 1);
    renderCalendar();
  });

  addListener('next-month', 'click', () => {
    datePickerViewDate.setMonth(datePickerViewDate.getMonth() + 1);
    renderCalendar();
  });

  document.querySelectorAll('.quick-date').forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.days);
      const date = new Date();
      date.setDate(date.getDate() + days);
      date.setHours(12, 0, 0, 0);
      selectedDueDate = date;
      selectedTime = selectedTime || '12:00';
      const timeInput = document.getElementById('task-time');
      if (timeInput) timeInput.value = selectedTime;
      const display = document.getElementById('date-picker-display');
      if (display) display.textContent = formatDateDisplay(selectedDueDate, selectedTime);
      toggleDatePicker(false);
    });
  });

  addListener('task-time', 'input', (e) => {
    selectedTime = e.target.value || null;
    const display = document.getElementById('date-picker-display');
    if (display) display.textContent = formatDateDisplay(selectedDueDate, selectedTime);
  });

  addListener('clear-time', 'click', () => {
    selectedTime = null;
    const timeInput = document.getElementById('task-time');
    if (timeInput) timeInput.value = '';
    const display = document.getElementById('date-picker-display');
    if (display) display.textContent = formatDateDisplay(selectedDueDate, selectedTime);
  });

  document.addEventListener('click', (e) => {
    const picker = document.getElementById('date-picker');
    const trigger = document.getElementById('date-picker-trigger');
    if (picker && !picker.classList.contains('hidden') && !picker.contains(e.target) && trigger && !trigger.contains(e.target)) {
      picker.classList.add('hidden');
    }
  });

  addListener('close-note-modal', 'click', closeNoteModal);
  addListener('note-modal', 'click', (e) => {
    if (e.target.id === 'note-modal') closeNoteModal();
  });

  addListener('note-pin-btn', 'click', () => {
    if (editingNote) {
      toggleNotePin(editingNote.id);
      closeNoteModal();
    }
  });

  addListener('note-delete-btn', 'click', () => {
    if (editingNote) {
      deleteNote(editingNote.id);
      closeNoteModal();
    }
  });

  addListener('save-note', 'click', saveNote);

  document.addEventListener('click', (e) => {
    const btn = document.getElementById('filter-btn');
    const menu = document.getElementById('filter-menu');
    if (btn && menu && !e.target.closest('#filter-btn') && !e.target.closest('#filter-menu')) {
      menu.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTaskModal();
      closeNoteModal();
      closeActivityModal();
    }
  });

  addListener('close-activity-modal', 'click', closeActivityModal);
  addListener('activity-modal', 'click', (e) => {
    if (e.target.id === 'activity-modal') closeActivityModal();
  });

  addListener('locate-me-btn', 'click', () => {
    initWeatherAndMap();
  });

  // Map Search Functionality
  const mapInput = document.getElementById('map-search-input');
  const mapSearchBtn = document.getElementById('map-search-btn');
  const mapClearBtn = document.getElementById('map-clear-btn');
  const mapSuggestions = document.getElementById('map-suggestions');

  if (mapInput) {
    mapInput.addEventListener('input', debounce(async (e) => {
      const query = e.target.value.trim();
      mapClearBtn.classList.toggle('hidden', !query);
      
      if (query.length > 2) {
        fetchSuggestions(query);
      } else {
        mapSuggestions.classList.add('hidden');
      }
    }, 300));

    mapInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleMapSearch(mapInput.value.trim());
    });
  }

  addListener('map-search-btn', 'click', () => {
    handleMapSearch(mapInput.value.trim());
  });

  addListener('map-clear-btn', 'click', () => {
    mapInput.value = '';
    mapClearBtn.classList.add('hidden');
    mapSuggestions.classList.add('hidden');
    mapInput.focus();
  });

  // Close suggestions on click outside
  document.addEventListener('click', (e) => {
    if (mapSuggestions && !mapSuggestions.contains(e.target) && e.target !== mapInput) {
      mapSuggestions.classList.add('hidden');
    }
  });
}

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function fetchSuggestions(query) {
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
    const data = await response.json();
    const suggestions = document.getElementById('map-suggestions');
    
    if (data.results && data.results.length > 0) {
      suggestions.innerHTML = data.results.map(res => `
        <button class="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0 transition" 
                onclick="selectSuggestion('${res.name}', ${res.latitude}, ${res.longitude}, '${res.admin1 || ''}', '${res.country}')">
          <i class="fas fa-map-marker-alt text-gray-400"></i>
          <div>
            <p class="text-sm font-semibold text-gray-800">${res.name}</p>
            <p class="text-xs text-gray-400">${res.admin1 ? res.admin1 + ', ' : ''}${res.country}</p>
          </div>
        </button>
      `).join('');
      suggestions.classList.remove('hidden');
    } else {
      suggestions.classList.add('hidden');
    }
  } catch (error) {
    console.error("Suggestions error:", error);
  }
}

// Exposed to global scope for onclick handler
window.selectSuggestion = (name, lat, lon, admin, country) => {
  const fullLocation = admin ? `${name}, ${admin}, ${country}` : `${name}, ${country}`;
  const input = document.getElementById('map-search-input');
  if (input) input.value = fullLocation;
  document.getElementById('map-suggestions').classList.add('hidden');
  updateAllLocationPanels(lat, lon, fullLocation);
  showToast(`Navigated to ${fullLocation}`);
};

async function handleMapSearch(query) {
  if (!query) return;
  
  // Update map immediately with the query string (best for landmarks/addresses)
  updateMapWithQuery(query);
  
  // Also try to geocode it to update the weather panel
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const { latitude, longitude, name, country, admin1 } = data.results[0];
      const locationName = admin1 ? `${name}, ${admin1}, ${country}` : `${name}, ${country}`;
      fetchWeather(latitude, longitude, locationName);
      showToast(`Showing ${locationName}`);
    }
  } catch (error) {
    console.error("Search error:", error);
  }
}

function updateMapWithQuery(query) {
  const mapContainer = document.getElementById('map-large');
  if (!mapContainer) return;
  
  mapContainer.innerHTML = `
    <iframe 
      width="100%" 
      height="100%" 
      frameborder="0" 
      scrolling="no" 
      marginheight="0" 
      marginwidth="0" 
      src="https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=en&z=15&amp;output=embed"
    ></iframe>
  `;
}

function updateAllLocationPanels(lat, lon, locationName) {
  fetchWeather(lat, lon, locationName);
  updateMapWithCoords(lat, lon);
}

function updateMapWithCoords(lat, lon) {
  const mapContainer = document.getElementById('map-large');
  if (!mapContainer) return;
  
  mapContainer.innerHTML = `
    <iframe 
      width="100%" 
      height="100%" 
      frameborder="0" 
      scrolling="no" 
      marginheight="0" 
      marginwidth="0" 
      src="https://maps.google.com/maps?q=${lat},${lon}&hl=en&z=15&amp;output=embed"
    ></iframe>
  `;
}

function init() {
  loadTasks();
  loadNotes();
  loadActivities();
  setupEventListeners();
  renderTasks();
  renderStats();
  renderNotes();
  initWeatherAndMap();
  switchTab('dashboard');
}

async function initWeatherAndMap() {
  if ("geolocation" in navigator) {
    // Show loading state for map
    const mapContainer = document.getElementById('map-large');
    mapContainer.innerHTML = `
      <div class="h-full w-full flex items-center justify-center text-gray-400">
        <div class="text-center">
          <i class="fas fa-spinner fa-spin text-4xl mb-4 text-purple-600"></i>
          <p>Locating you...</p>
        </div>
      </div>
    `;

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      
      let locationName = "Your Location";
      try {
        // Reverse Geocoding to get the actual city name
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
        const data = await response.json();
        if (data.city || data.locality) {
          locationName = data.city || data.locality;
          if (data.principalSubdivision) locationName += `, ${data.principalSubdivision}`;
          if (data.countryName) locationName += `, ${data.countryName}`;
        }
      } catch (e) {
        console.error("Reverse geocoding failed:", e);
      }

      updateAllLocationPanels(latitude, longitude, locationName);
    }, (error) => {
      console.error("Geolocation error:", error);
      document.getElementById('weather-location-large').textContent = "Location access denied";
      mapContainer.innerHTML = `
        <div class="h-full w-full flex items-center justify-center text-gray-400 text-center p-8">
          <div>
            <i class="fas fa-location-slash text-5xl mb-4"></i>
            <p>Enable location access to see maps and weather.</p>
          </div>
        </div>
      `;
    });
  } else {
    document.getElementById('weather-location-large').textContent = "Geolocation not supported";
  }
}

async function fetchWeather(lat, lon, locationName = "Your Location") {
  try {
    // Request current weather + daily forecast + additional metrics
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,weathercode,uv_index&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.current_weather) {
      const current = data.current_weather;
      const weatherInfo = getWeatherInfo(current.weathercode);
      
      // Update dashboard weather
      updateDashboardWeather(current, locationName);
      
      // Update Current Weather Card
      document.getElementById('weather-temp-large').textContent = `${Math.round(current.temperature)}°C`;
      document.getElementById('weather-desc-large').textContent = weatherInfo.desc;
      document.getElementById('weather-icon-large').className = `fas ${weatherInfo.icon} text-8xl ${weatherInfo.color}`;
      document.getElementById('weather-location-large').innerHTML = `
        <i class="fas fa-location-dot"></i>
        <span>${locationName}</span>
      `;

      // Update Details Grid
      // Find current hour index to get hourly data
      const now = new Date();
      const currentHourStr = now.toISOString().slice(0, 13) + ':00';
      const hourIndex = data.hourly.time.findIndex(t => t.startsWith(currentHourStr)) || 0;

      document.getElementById('weather-humidity').textContent = `${data.hourly.relativehumidity_2m[hourIndex]}%`;
      document.getElementById('weather-wind').textContent = `${Math.round(current.windspeed)} km/h`;
      document.getElementById('weather-uv').textContent = data.hourly.uv_index[hourIndex].toFixed(1);
      document.getElementById('weather-precip').textContent = `${data.hourly.precipitation_probability[hourIndex]}%`;

      // Render Hourly Forecast (next 24 hours)
      renderHourlyForecast(data.hourly, hourIndex);

      // Render 7-Day Forecast
      renderForecast(data.daily);
    }
  } catch (error) {
    console.error("Weather fetch error:", error);
    document.getElementById('weather-desc-large').textContent = "Failed to load weather";
  }
}

function renderHourlyForecast(hourly, currentHourIndex) {
  const container = document.getElementById('hourly-forecast-container');
  
  // Get next 24 hours starting from current hour
  const next24Hours = [];
  for (let i = 0; i < 24; i++) {
    const index = currentHourIndex + i;
    if (index < hourly.time.length) {
      next24Hours.push({
        time: hourly.time[index],
        temp: Math.round(hourly.temperature_2m[index]),
        code: hourly.weathercode[index]
      });
    }
  }

  container.innerHTML = next24Hours.map((hour, i) => {
    const date = new Date(hour.time);
    const timeString = i === 0 ? 'Now' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const info = getWeatherInfo(hour.code);

    return `
      <div class="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col items-center gap-3 shadow-sm hover:shadow-md transition min-w-[100px] flex-shrink-0">
        <p class="text-sm font-bold text-gray-500">${timeString}</p>
        <i class="fas ${info.icon} text-2xl ${info.color}"></i>
        <p class="text-lg font-bold text-gray-800">${hour.temp}°</p>
      </div>
    `;
  }).join('');
}

function renderForecast(daily) {
  const container = document.getElementById('forecast-container');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  container.innerHTML = daily.time.map((time, i) => {
    const date = new Date(time);
    const dayName = i === 0 ? 'Today' : days[date.getDay()];
    const info = getWeatherInfo(daily.weathercode[i]);
    const maxTemp = Math.round(daily.temperature_2m_max[i]);
    const minTemp = Math.round(daily.temperature_2m_min[i]);

    return `
      <div class="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col items-center gap-3 shadow-sm hover:shadow-md transition">
        <p class="text-sm font-bold text-gray-500">${dayName}</p>
        <i class="fas ${info.icon} text-3xl ${info.color}"></i>
        <div class="text-center">
          <p class="text-lg font-bold text-gray-800">${maxTemp}°</p>
          <p class="text-xs text-gray-400">${minTemp}°</p>
        </div>
        <p class="text-[10px] text-gray-400 font-medium uppercase text-center">${info.desc}</p>
      </div>
    `;
  }).join('');
}

function getWeatherInfo(code) {
  // Simple mapping of WMO Weather interpretation codes
  if (code === 0) return { desc: "Clear sky", icon: "fa-sun", color: "text-yellow-500" };
  if (code <= 3) return { desc: "Partly cloudy", icon: "fa-cloud-sun", color: "text-blue-400" };
  if (code <= 48) return { desc: "Foggy", icon: "fa-smog", color: "text-gray-400" };
  if (code <= 67) return { desc: "Rainy", icon: "fa-cloud-showers-heavy", color: "text-blue-600" };
  if (code <= 77) return { desc: "Snowy", icon: "fa-snowflake", color: "text-blue-200" };
  if (code <= 82) return { desc: "Rain showers", icon: "fa-cloud-rain", color: "text-blue-500" };
  if (code <= 99) return { desc: "Thunderstorm", icon: "fa-bolt", color: "text-purple-600" };
  return { desc: "Cloudy", icon: "fa-cloud", color: "text-gray-500" };
}

init();
