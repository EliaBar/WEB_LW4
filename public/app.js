const API_URL = '/api/teachers';

const teacherForm = document.getElementById('teacher-form');
const teacherIdInput = document.getElementById('teacher-id');
const lastNameInput = document.getElementById('last_name');
const positionInput = document.getElementById('position');
const degreeInput = document.getElementById('degree');
const classroomInput = document.getElementById('classroom');

const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const refreshBtn = document.getElementById('refresh-btn');

const tbody = document.getElementById('teachers-tbody');
const emptyState = document.getElementById('empty-state');
const alertBox = document.getElementById('alert-box');

function showAlert(message, type = 'success') {
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = message;
  alertBox.classList.remove('hidden');

  setTimeout(() => {
    alertBox.classList.add('hidden');
  }, 4000);
}

async function fetchTeachers() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Не вдалося отримати викладачів');
    
    const teachers = await response.json();
    renderTable(teachers);
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

function renderTable(teachers) {
  tbody.innerHTML = '';
  if (teachers.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  teachers.forEach((t) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.id}</td>
      <td><strong>${escapeHtml(t.last_name)}</strong></td>
      <td>${escapeHtml(t.position)}</td>
      <td>${escapeHtml(t.degree)}</td>
      <td>${escapeHtml(t.classroom)}</td>
      <td class="actions-cell">
        <button class="btn btn-secondary btn-sm" onclick="startEdit(${t.id})">Редагувати</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTeacher(${t.id})">Видалити</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function resetForm() {
  teacherIdInput.value = '';
  teacherForm.reset();
  positionInput.selectedIndex = 0;
  degreeInput.selectedIndex = 0;
  formTitle.textContent = 'Додати викладача';
  submitBtn.textContent = 'Зберегти';
  cancelBtn.classList.add('hidden');
}

async function startEdit(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) throw new Error('Помилка завантаження даних викладача');

    const teacher = await response.json();

    teacherIdInput.value = teacher.id;
    lastNameInput.value = teacher.last_name;
    positionInput.value = teacher.position;
    degreeInput.value = teacher.degree;
    classroomInput.value = teacher.classroom;

    formTitle.textContent = `Редагувати викладача (ID: ${teacher.id})`;
    submitBtn.textContent = 'Зберегти зміни';
    cancelBtn.classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

teacherForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = teacherIdInput.value;
  const payload = {
    last_name: lastNameInput.value.trim(),
    position: positionInput.value.trim(),
    degree: degreeInput.value.trim(),
    classroom: classroomInput.value.trim(),
  };

  const isEditing = Boolean(id);
  const url = isEditing ? `${API_URL}/${id}` : API_URL;
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Помилка виконання операції');
    }

    showAlert(isEditing ? 'Дані викладача успішно оновлено!' : 'Викладача успішно додано!');
    resetForm();
    fetchTeachers();
  } catch (error) {
    showAlert(error.message, 'error');
  }
});

async function deleteTeacher(id) {
  if (!confirm(`Ви дійсно бажаєте видалити викладача з ID ${id}?`)) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Не вдалося видалити запис');
    }

    showAlert('Запис видалено успішно!');
    if (teacherIdInput.value === String(id)) {
      resetForm();
    }
    fetchTeachers();
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

cancelBtn.addEventListener('click', resetForm);
refreshBtn.addEventListener('click', fetchTeachers);

fetchTeachers();