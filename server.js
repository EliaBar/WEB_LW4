const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ALLOWED_POSITIONS = [
  'Асистент',
  'Викладач',
  'Старший викладач',
  'Доцент',
  'Професор',
  'Завідувач кафедри'
];

const ALLOWED_DEGREES = [
  'Без ступеня',
  'Кандидат наук',
  'Доктор філософії (PhD)',
  'Доктор наук'
];

const CYRILLIC_NAME_REGEX = /^[А-ЯІЇЄҐа-яіїєґ]+(['\-][А-ЯІЇЄҐа-яіїєґ]+)*$/;
const CLASSROOM_NUMBER = /^[0-9]+$/;

function validateTeacherData(data) {
  const { last_name, position, degree, classroom } = data;

  if (!last_name || typeof last_name !== 'string' || !last_name.trim()) {
    return 'Прізвище є обов’язковим полем.';
  }
  const cleanLastName = last_name.trim();
  if (!CYRILLIC_NAME_REGEX.test(cleanLastName)) {
    return 'Прізвище повинно містити лише літери кирилиці (дозволено дефіс та апостроф).';
  }

  if (!position || !ALLOWED_POSITIONS.includes(position.trim())) {
    return `Некоректна посада. Дозволені значення: ${ALLOWED_POSITIONS.join(', ')}.`;
  }

  if (!degree || !ALLOWED_DEGREES.includes(degree.trim())) {
    return `Некоректний науковий ступінь. Дозволені значення: ${ALLOWED_DEGREES.join(', ')}.`;
  }

  if (!classroom || typeof classroom !== 'string' || !classroom.trim()) {
    return 'Номер аудиторії є обов’язковим полем.';
  }
  if (!CLASSROOM_NUMBER.test(classroom.trim())) {
    return 'Номер аудиторії повинен містити лише цифри.';
  }

  return null;
}

app.get('/api/teachers', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM teachers ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error('Помилка отримання списку:', error);
    res.status(500).json({ error: 'Помилка сервера при отриманні списку викладачів.' });
  }
});

app.get('/api/teachers/:id', async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Некоректний ID викладача.' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM teachers WHERE id = ?', [teacherId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Викладача з таким ID не знайдено.' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Помилка отримання запису:', error);
    res.status(500).json({ error: 'Помилка сервера при завантаженні запису.' });
  }
});

app.post('/api/teachers', async (req, res) => {
  const validationError = validateTeacherData(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { last_name, position, degree, classroom } = req.body;
  const cleanClassroom = classroom.trim();

  try {
    const [existing] = await db.query(
      'SELECT id, last_name FROM teachers WHERE classroom = ?',
      [cleanClassroom]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: `Аудиторія "${cleanClassroom}" вже закріплена за викладачем ${existing[0].last_name}.`
      });
    }

    const query = `
      INSERT INTO teachers (last_name, position, degree, classroom)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [
      last_name.trim(),
      position.trim(),
      degree.trim(),
      cleanClassroom
    ]);

    res.status(201).json({
      id: result.insertId,
      last_name: last_name.trim(),
      position: position.trim(),
      degree: degree.trim(),
      classroom: cleanClassroom
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `Аудиторія "${cleanClassroom}" вже зайнята.` });
    }
    console.error('Помилка збереження:', error);
    res.status(500).json({ error: 'Не вдалося створити запис про викладача.' });
  }
});

app.put('/api/teachers/:id', async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Некоректний ID викладача.' });
  }

  const validationError = validateTeacherData(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { last_name, position, degree, classroom } = req.body;
  const cleanClassroom = classroom.trim();

  try {
    // Перевірка, чи не закріплена ця аудиторія за ІНШИМ викладачем
    const [existing] = await db.query(
      'SELECT id, last_name FROM teachers WHERE classroom = ? AND id != ?',
      [cleanClassroom, teacherId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: `Аудиторія "${cleanClassroom}" вже закріплена за викладачем ${existing[0].last_name}.`
      });
    }

    const query = `
      UPDATE teachers
      SET last_name = ?, position = ?, degree = ?, classroom = ?
      WHERE id = ?
    `;
    const [result] = await db.query(query, [
      last_name.trim(),
      position.trim(),
      degree.trim(),
      cleanClassroom,
      teacherId
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Викладача для оновлення не знайдено.' });
    }

    res.json({
      id: teacherId,
      last_name: last_name.trim(),
      position: position.trim(),
      degree: degree.trim(),
      classroom: cleanClassroom
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `Аудиторія "${cleanClassroom}" вже зайнята.` });
    }
    console.error('Помилка оновлення:', error);
    res.status(500).json({ error: 'Помилка сервера при оновленні запису.' });
  }
});

app.delete('/api/teachers/:id', async (req, res) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId)) {
    return res.status(400).json({ error: 'Некоректний ID викладача.' });
  }

  try {
    const [result] = await db.query('DELETE FROM teachers WHERE id = ?', [teacherId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Викладача для видалення не знайдено.' });
    }
    res.json({ message: 'Запис успішно видалено', id: teacherId });
  } catch (error) {
    console.error('Помилка видалення:', error);
    res.status(500).json({ error: 'Помилка сервера під час видалення запису.' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущено: http://localhost:${PORT}`);
});