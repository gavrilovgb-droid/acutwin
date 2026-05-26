import { apiAddUser, apiGetUsers, apiGetRecords, apiAddRecord, apiGetClinic, apiSetClinic } from './api.js';
import { uniqueId } from './shared.js';

const DOCTORS = [
  { name: 'Иванов И.И.',  username: 'ivanov',  password: '1' },
  { name: 'Петров П.П.',  username: 'petrov',  password: '2' },
  { name: 'Сидоров С.С.', username: 'sidorov', password: '3' },
];

const PATIENTS = {
  ivanov:  [ { name: 'Смирнова Е.П.', age: 42, gender: 'Ж' }, { name: 'Козлов В.А.',    age: 55, gender: 'М' }, { name: 'Морозова Н.С.', age: 38, gender: 'Ж' }, { name: 'Белов Д.К.',     age: 61, gender: 'М' }, { name: 'Яковлева О.И.', age: 29, gender: 'Ж' } ],
  petrov:  [ { name: 'Новиков А.М.',  age: 48, gender: 'М' }, { name: 'Волкова Т.Р.',   age: 35, gender: 'Ж' }, { name: 'Лебедев С.П.',  age: 58, gender: 'М' }, { name: 'Зайцева К.Н.',  age: 31, gender: 'Ж' }, { name: 'Кузнецов И.В.', age: 67, gender: 'М' } ],
  sidorov: [ { name: 'Попова А.С.',   age: 44, gender: 'Ж' }, { name: 'Соколов М.В.',  age: 52, gender: 'М' }, { name: 'Никитина Л.Г.', age: 37, gender: 'Ж' }, { name: 'Орлов Б.Д.',    age: 63, gender: 'М' }, { name: 'Фёдорова Е.Н.', age: 26, gender: 'Ж' } ],
};

const SCENARIOS = [
  { reason: 'Бессонница, тревожность, раздражительность', meridians: ['C','MC'], points: ['C7','MC6','TR5','C3','RP6'], notes: ['Первичная диагностика. Избыток Ян Сердца.','Динамика слабоположительная.','Заметное улучшение сна.','Хорошая динамика.','Завершение курса. Сон нормализовался.'], outcomes: ['neutral','neutral','positive','positive','positive'] },
  { reason: 'Хронические боли в пояснице, слабость',       meridians: ['V','R'],  points: ['V23','V52','R3','R7','VB25'], notes: ['Первичный осмотр. Недостаток Инь Почек.','Боль снизилась незначительно.','Положительная динамика.','Значительное улучшение.','Завершение курса. Болей нет.'], outcomes: ['neutral','neutral','positive','positive','positive'] },
  { reason: 'Мигрень, головные боли, головокружение',       meridians: ['VB','F'], points: ['VB20','VB34','F3','F8','TR5'], notes: ['Диагностика. Застой Ци Печени.','Частота приступов не изменилась.','Приступы 1 раз в неделю.','Приступов за 2 недели не было.','Стойкая ремиссия.'], outcomes: ['neutral','neutral','positive','positive','positive'] },
];

function makeRecords(doctorUsername, doctorName, patients) {
  const records = [];
  const base = new Date('2026-03-01');
  patients.forEach((patient, pi) => {
    const sc = SCENARIOS[pi % SCENARIOS.length];
    for (let v = 0; v < 5; v++) {
      const d = new Date(base);
      d.setDate(d.getDate() + pi * 14 + v * 7);
      records.push({
        id: uniqueId(), doctor: doctorUsername, doctorName,
        date: d.toISOString().slice(0,10), time: `${9 + (pi % 4)}:${v % 2 === 0 ? '00' : '30'}`,
        patient: patient.name, age: String(patient.age), gender: patient.gender,
        reason: sc.reason, notes: sc.notes[v], points: sc.points, meridians: sc.meridians,
        type: 'Акупунктура', outcome: sc.outcomes[v],
      });
    }
  });
  return records;
}

export async function seedIfEmpty() {
  // Сначала проверяем статус /api/users напрямую:
  // — 401 → БД не пуста, пользователь не авторизован → нечего делать
  // — 200 → БД пуста или авторизован → можно сидировать
  let usersResp;
  try {
    usersResp = await fetch('/api/users');
  } catch { return; } // сервер недоступен

  if (usersResp.status !== 200) return; // 401/403 — не первый запуск или нет прав

  const users = await usersResp.json().catch(() => []);
  const usernames = new Set((Array.isArray(users) ? users : []).map(u => u.username));

  // Создаём только тех пользователей, которых ещё нет
  for (const d of DOCTORS) {
    if (!usernames.has(d.username)) await apiAddUser(d.username, d.name, d.password, 'doctor');
  }
  if (!usernames.has('boss'))  await apiAddUser('boss',  'Босс',            '123',      'boss');
  if (!usernames.has('admin')) await apiAddUser('admin', 'Администратор',   'admin2026','admin');

  // Остальное (клиника, записи) — только при наличии токена (после входа)
  const token = sessionStorage.getItem('acutwin_token');
  if (!token) return;

  const clinic = await apiGetClinic();
  if (clinic && !clinic.name) {
    await apiSetClinic({
      name: 'Клиника восточной медицины «АкуТвин»',
      address: 'г. Москва, ул. Профсоюзная, д. 45, офис 12',
      phone: '+7 (495) 123-45-67',
      email: 'info@acutwin.ru',
      site: 'https://acutwin.ru',
      inn: '7704567890',
    });
  }

  const seeded = localStorage.getItem('acutwin_demo_seeded');
  if (!seeded) {
    let existing;
    try { existing = await apiGetRecords(); } catch { existing = []; }
    if (existing.length === 0) {
      for (const d of DOCTORS) {
        for (const rec of makeRecords(d.username, d.name, PATIENTS[d.username])) {
          await apiAddRecord(rec);
        }
      }
    }
    localStorage.setItem('acutwin_demo_seeded', '1');
  }
}
