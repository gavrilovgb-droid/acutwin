import { initI18n, t } from '/i18n.js';

// i18n: обновляем [data-i18n] и [data-i18n-title] элементы после загрузки локали
export function applyI18nToDom(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t(el.getAttribute('data-i18n'));
    if (v && v !== el.getAttribute('data-i18n')) el.textContent = v;
  });
  scope.querySelectorAll('[data-i18n-title]').forEach(el => {
    const v = t(el.getAttribute('data-i18n-title'));
    if (v && v !== el.getAttribute('data-i18n-title')) el.title = v;
  });
  scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const v = t(el.getAttribute('data-i18n-placeholder'));
    if (v && v !== el.getAttribute('data-i18n-placeholder')) el.placeholder = v;
  });
}
initI18n().then(() => applyI18nToDom());

// Глобальный обработчик logout — использует t() для confirm-текста
window._logoutConfirm = function() {
  if (confirm(t('auth:login.logoutConfirm'))) {
    sessionStorage.clear();
    location.href = 'login.html';
  }
};

// Защита видео от скачивания
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) e.preventDefault();
});
document.addEventListener('dragstart', e => {
  if (e.target.tagName === 'VIDEO') e.preventDefault();
});

// Скорость воспроизведения 1.25× для всех видео
document.addEventListener('play', e => {
  if (e.target.tagName === 'VIDEO') e.target.playbackRate = 1.25;
}, true);

export const MER_ORDER = ['P','Gi','E','RP','C','iG','V','R','MC','TR','VB','F'];

export const MERIDIANS = {
  P:  { name:'Лёгкие',               nameFr:'Poumon',              element:'Металл', code:'LU', color:'#5a8fa8' }, /* i18n-ok */
  Gi: { name:'Толстый кишечник',      nameFr:'Gros Intestin',       element:'Металл', code:'LI', color:'#5a8fa8' }, /* i18n-ok */
  E:  { name:'Желудок',              nameFr:'Estomac',             element:'Земля',  code:'ST', color:'#c07840' }, /* i18n-ok */
  RP: { name:'Селезёнка',            nameFr:'Rate-Pancréas',       element:'Земля',  code:'SP', color:'#c07840' }, /* i18n-ok */
  C:  { name:'Сердце',               nameFr:'Cœur',                element:'Огонь',  code:'HT', color:'#c0392b' }, /* i18n-ok */
  iG: { name:'Тонкий кишечник',      nameFr:'Intestin Grêle',      element:'Огонь',  code:'SI', color:'#c0392b' }, /* i18n-ok */
  V:  { name:'Мочевой пузырь',       nameFr:'Vessie',              element:'Вода',   code:'BL', color:'#2471a3' }, /* i18n-ok */
  R:  { name:'Почки',                nameFr:'Rein',                element:'Вода',   code:'KI', color:'#2471a3' }, /* i18n-ok */
  MC: { name:'Перикард',             nameFr:'Maître du Cœur',      element:'Огонь',  code:'PC', color:'#a0305a' }, /* i18n-ok */
  TR: { name:'Тройной обогреватель', nameFr:'Triple Réchauffeur',  element:'Огонь',  code:'TE', color:'#a0305a' }, /* i18n-ok */
  VB: { name:'Желчный пузырь',       nameFr:'Vésicule Biliaire',   element:'Дерево', code:'GB', color:'#3d8a5c' }, /* i18n-ok */
  F:  { name:'Печень',               nameFr:'Foie',                element:'Дерево', code:'LR', color:'#3d8a5c' }, /* i18n-ok */
  T:  { name:'Задне-Срединный',      nameFr:'Vaisseau Gouverneur', element:'Чудесный', code:'DU', display:'VG', color:'#8b6db5' }, /* i18n-ok */
  J:  { name:'Передне-Срединный',    nameFr:'Vaisseau Conception', element:'Чудесный', code:'RN', display:'VC', color:'#8b6db5' }, /* i18n-ok */
};

export const MER_SIGNS = {
  P:  {
    excess:'Повышенная температура тела,Потливость,Горячая на ощупь ладонь,Звонкий кашель с болью,Обилие мокроты,Астма,Прилив крови к голове,Боль в области спины и плеча,Напряжение мышц плеча', /* i18n-ok */
    defic: 'Озноб,Холодный пот,Насморк,Хриплый кашель,Сухость в горле,Головокружение,Боль в области ключицы и грудной клетки,Чувство онемения и похолодания верхних конечностей,Кожный зуд,Бессонница', /* i18n-ok */
  },
  Gi: {
    excess:'Запор,Боль и вздутие живота,Головная боль,Боль в плече и предплечье,Боль в пальцах рук,Тело горячее,Сухость во рту,Состояние ухудшается в тепле', /* i18n-ok */
    defic: 'Понос,Урчание в животе,Расстройства функции кишечника,Головокружение,Слабость верхних конечностей,Тело холодное,Сыпь и зуд,Небольшой кашель,Покраснение задней стенки глотки,Состояние улучшается в тепле', /* i18n-ok */
  },
  E:  {
    excess:'Возбуждение,Высокая температура тела,Вздутие живота,Отрыжка,Запор,Повышенный аппетит,Боль спазматического характера в желудке,Повышенная кислотность,Трещины слизистой оболочки губ,Боль и судороги мышц ног,Сыпь', /* i18n-ok */
    defic: 'Урчание в животе,Понос,Рвота после еды,Потеря аппетита,Замедленное пищеварение,Чувство переполнения в желудке,Пониженная кислотность,Вялость,Депрессивное состояние,Набухание слизистой оболочки горла,Слабость нижних конечностей', /* i18n-ok */
  },
  RP: {
    excess:'Неустойчивый аппетит,Чувство переполнения в животе,Запор,Боль и ощущение тяжести в подреберье,Тошнота,Отрыжка воздухом,Пищевая интоксикация,Боль в суставах ног,Ограничение движения I пальца стопы,Тяжёлый сон', /* i18n-ok */
    defic: 'Плохое пищеварение,Газы в желудке,Большое количество испражнений,Боль в надчревной области,Рвота,Слабость и онемение ног,Венозный застой в ногах,Кожные расстройства,Сонливость в течение дня', /* i18n-ok */
  },
  C:  {
    excess:'Боль в области сердца,Боль в плече и предплечье,Гиперемированное лицо,Повышенная возбудимость,Ощущение тяжести в конечностях и груди,Повышение температуры тела,Сухость во рту', /* i18n-ok */
    defic: 'Сердцебиение,Одышка при физической нагрузке,Бледное лицо,Чувство подавленности и тоски,Чувство страха,Онемение внутренней поверхности плеча,Головокружение из-за недостаточности кровообращения', /* i18n-ok */
  },
  iG: {
    excess:'Боль в шее и затылке,Боль в висках,Звон в ушах,Боль в нижней части живота,Запор,Боль по задней стороне плеча и предплечья', /* i18n-ok */
    defic: 'Отёчность в области нижней челюсти и шеи,Шум в ушах,Снижение слуха,Уменьшение массы тела,Тошнота,Рвота,Понос,Слабость конечностей,Ощущение холода в конечностях', /* i18n-ok */
  },
  V:  {
    excess:'Частое мочеиспускание,Болезненные спазмы со стороны мочеполовых органов,Боль и напряжение мышц спины,Боль в позвоночнике,Боль и спазмы мышц нижних конечностей,Головная боль в лобной и затылочной областях,Избыточное слезотечение,Боль в глазах,Кровотечение из носа', /* i18n-ok */
    defic: 'Редкое обильное мочеиспускание,Отёчность в области половых органов,Гипотония мышц затылка и позвоночника,Неподвижность бедра,Ощущение тяжести и слабости нижних конечностей,Головокружение,Слабость мышц спины,Геморрой', /* i18n-ok */
  },
  R:  {
    excess:'Редкое мочеиспускание,Моча тёмного цвета,Сухость во рту,Тошнота,Ощущение тяжести и жара в ногах,Ступня горячая на ощупь,Боль в крестце и пояснице,Боль во внутренней части бедра,Необычный прилив энергии,Повышение сексуальной потенции', /* i18n-ok */
    defic: 'Учащённое мочеиспускание,Обильное потоотделение,Ощущение холода в ногах,Ступня холодная на ощупь,Онемение и слабость нижних конечностей,Слабость и вялость,Чувство страха и нерешительности,Снижение сексуальной потенции', /* i18n-ok */
  },
  MC: {
    excess:'Раздражительность,Боль в грудной клетке,Нарушения функции сердечно-сосудистой системы,Головная боль с ощущением приливов,Боль в верхних конечностях,Неглубокий сон,Покраснение склер,Запор', /* i18n-ok */
    defic: 'Депрессия,Утомляемость,Учащённое сердцебиение,Головокружения,Одышка,Боязнь высоты,Слабость верхних конечностей,Боль в животе,Желтушность склер,Понос,Глубокий сон с большим количеством сновидений', /* i18n-ok */
  },
  TR: {
    excess:'Боль в верхних конечностях,Боль в лопатке и шее,Звон в ушах,Гиперемированное лицо,Непереносимость жары,Отсутствие аппетита,Обильное мочеиспускание,Бессонница,Раздражительность', /* i18n-ok */
    defic: 'Онемение и слабость конечностей,Онемение и слабость в шее,Бледное лицо,Поверхностное дыхание,Озноб,Непереносимость холода,Пониженное мочеиспускание,Психическая и физическая усталость,Грусть,Вялость,Ослабление слуха', /* i18n-ok */
  },
  VB: {
    excess:'Чувство полноты в желудке,Горечь во рту,Тошнота,Припухлость щёк и шеи,Заболевания горла,Бессонница,Головная боль,Боль и судороги в бедре и голени,Горячая на ощупь стопа', /* i18n-ok */
    defic: 'Слабость и отсутствие сил,Припухлость в подколенной ямке и стопе,Отёчность суставов нижних конечностей,Заболевания глаз,Желтушность склер,Рвота желчью,Сонливость,Ночная потливость,Тяжёлые и глубокие вздохи', /* i18n-ok */
  },
  F:  {
    excess:'Головная боль,Желтушность кожи,Боль в пояснице и половых органах,Затруднённое мочеиспускание,Нарушения менструального цикла,Чувство гнева,Раздражительность,Лёгкая возбудимость,Импульсивность', /* i18n-ok */
    defic: 'Головокружение,Бледный цвет кожи,Расстройства кишечника,Половая холодность,Боль в бедре и малом тазу,Слабость нижних конечностей,Быстрая утомляемость,Ухудшение зрения,Депрессия,Чувство страха', /* i18n-ok */
  },
};

// Собственная точка меридиана: s=седатирование (избыток), n=тонизирование (недостаток)
export const OWN = {
  C:  { s:{pt:'C7',   t:'11–13 ч', tech:'укол прямой, глубина до 10 мм (либо под сухожилие лок. сгибателя запястья); термопунктура — обычная'}, /* i18n-ok */
        n:{pt:'C9',   t:'13–15 ч', tech:'укол наклонный или почти горизонтальный, глубина 3 мм; дистантное воздействие до 5 мин'} }, /* i18n-ok */
  E:  { s:{pt:'E45',  t:'7–9 ч',   tech:'укол наклонный, глубина 3 мм; дистантное воздействие до 5 мин'}, /* i18n-ok */
        n:{pt:'E41',  t:'9–11 ч',  tech:'укол наклонный, по направлению к пятке, глубина 10–15 мм; дистантное воздействие до 10 мин'} }, /* i18n-ok */
  F:  { s:{pt:'F2',   t:'1–3 ч',   tech:'укол прямой, глубина 10 мм; дистантное воздействие до 10 мин'}, /* i18n-ok */
        n:{pt:'F8',   t:'3–5 ч',   tech:'укол прямой (ногу предварительно несколько разогнуть), глубина 10–15 мм; дистантное воздействие до 10 мин'} }, /* i18n-ok */
  Gi: { s:{pt:'Gi2',  t:'5–7 ч',   tech:'укол прямой, глубина 5–10 мм; дистантное воздействие до 5 мин'}, /* i18n-ok */
        n:{pt:'Gi11', t:'7–9 ч',   tech:'укол прямой, при слегка согнутой руке, глубина 15–25 мм; термопунктура — обычная'} }, /* i18n-ok */
  iG: { s:{pt:'iG8',  t:'13–15 ч', tech:'укол наклонный, по ходу локтевой бороздки, глубина ~5 мм; дистантное воздействие до 10 мин'}, /* i18n-ok */
        n:{pt:'iG3',  t:'15–17 ч', tech:'укол наклонный, глубина 5–10 мм; дистантное воздействие до 10 мин'} }, /* i18n-ok */
  MC: { s:{pt:'MC7',  t:'19–21 ч', tech:'укол прямой, глубина 10 мм; дистантное воздействие до 5 мин'}, /* i18n-ok */
        n:{pt:'MC9',  t:'19–21 ч', tech:'укол наклонный или горизонтальный, глубина 3 мм; дистантное воздействие до 5 мин'} }, /* i18n-ok */
  P:  { s:{pt:'P5',   t:'3–5 ч',   tech:'рука несколько согнута в локтевом суставе, укол прямой, глубина ~10 мм; дистантное воздействие до 5 мин'}, /* i18n-ok */
        n:{pt:'P9',   t:'5–7 ч',   tech:'укол наклонный, в обход артерии, глубина ~5 мм; дистантное воздействие 1–3 мин'} }, /* i18n-ok */
  R:  { s:{pt:'R1',   t:'17–19 ч', tech:'укол прямой, глубина 10–15 мм; термопунктура до 5 мин'}, /* i18n-ok */
        n:{pt:'R7',   t:'19–21 ч', tech:'укол прямой, глубина 10 мм; термопунктура до 10 мин'} }, /* i18n-ok */
  RP: { s:{pt:'RP5',  t:'9–11 ч',  tech:'укол наклонный, глубина 10 мм; дистантное воздействие до 10 мин'}, /* i18n-ok */
        n:{pt:'RP2',  t:'11–13 ч', tech:'укол наклонный, глубина 10 мм; дистантное воздействие до 10 мин'} }, /* i18n-ok */
  TR: { s:{pt:'TR10', t:'21–23 ч', tech:'укол прямой, глубина 10–15 мм; термопунктура — обычная'}, /* i18n-ok */
        n:{pt:'TR3',  t:'23–1 ч',  tech:'укол прямой, глубина ~10 мм; дистантное воздействие до 10 мин'} }, /* i18n-ok */
  V:  { s:{pt:'V65',  t:'15–17 ч', tech:'укол наклонный, глубина 5–10 мм; дистантное воздействие до 10 мин'}, /* i18n-ok */
        n:{pt:'V67',  t:'17–19 ч', tech:'укол наклонный, глубина 3 мм; дистантное воздействие до 5 мин'} }, /* i18n-ok */
  VB: { s:{pt:'VB38', t:'23–1 ч',  tech:'укол прямой, глубина 10–15 мм; термопунктура — обычная'}, /* i18n-ok */
        n:{pt:'VB43', t:'1–3 ч',   tech:'укол наклонный, глубина 10 мм; дистантное воздействие до 5 мин'} }, /* i18n-ok */
};

// Энергетический баланс: ex=избыток(седатируем), def=недостаток(тонизируем)
export const EB = {
  C:{
    ex:{ ms_d:'Сед RP5 (9–11 ч), тон iG3 (15–17 ч)', ms_y:'Сед F2 (1–3 ч), тон iG3 (15–17 ч)', big:'Сед C5 (ло-пункт), тон iG4 (т-пособник)', hw:'Тон R7', nm:'Тон VB43', ushu:'Тон C9, сед C8', usin:'Сед C7, RP3; тон C3, R10', via:'Сед F8 в следующие 2 ч активности мер.' }, /* i18n-ok */
    def:{ ms_d:'Тон RP2 (11–13 ч), сед iG8 (13–15 ч)', ms_y:'Тон F8 (3–5 ч), сед iG8 (13–15 ч)', big:'Сед iG7 (ло-пункт), тон C7 (т-пособник)', hw:'Сед R1, R2', nm:'Сед VB38', ushu:'Сед C9, тон C8', usin:'Тон C9, F1; сед C3, R10', via:'Тон RP5 в час активности мер.' } /* i18n-ok */
  },
  E:{
    ex:{ ms_d:'Сед Gi2 (5–7 ч), тон RP2 (11–13 ч)', ms_y:'Сед iG8 (13–15 ч), тон RP2 (11–13 ч)', big:'Сед E40 (ло-пункт), тон RP3 (т-пособник)', hw:'Тон VB43', nm:'Тон MC9', ushu:'Тон E36, сед E45', usin:'Сед E45, Gi1; тон E43, VB41', via:'Сед iG3 в следующие 2 ч активности мер.' }, /* i18n-ok */
    def:{ ms_d:'Тон Gi11 (7–9 ч), сед RP5 (9–11 ч)', ms_y:'Тон iG3 (15–17 ч), сед RP5 (9–11 ч)', big:'Сед RP4 (ло-пункт), тон E42 (т-пособник)', hw:'Сед VB38', nm:'Сед MC7', ushu:'Сед E36, тон E45', usin:'Тон E41, iG5; сед E43, VB41', via:'Тон Gi2 в час активности мер.' } /* i18n-ok */
  },
  F:{
    ex:{ ms_d:'Сед VB38 (23–1 ч), тон P9 (5–7 ч)', ms_y:'Сед VB38 (23–1 ч), тон C9 (13–15 ч)', big:'Сед F5 (ло-пункт), тон VB40 (т-пособник)', hw:'Тон P9', nm:'Тон iG3', ushu:'Тон F1, сед F2', usin:'Сед F2, C8; тон F4, P8', via:'Сед R7 в следующие 2 ч активности мер.' }, /* i18n-ok */
    def:{ ms_d:'Тон VB43 (1–3 ч), сед P5 (3–5 ч)', ms_y:'Тон VB43 (1–3 ч), сед C7 (11–13 ч)', big:'Сед VB37 (ло-пункт), тон F3 (т-пособник)', hw:'Сед P5', nm:'Сед iG8', ushu:'Сед F1, тон F2', usin:'Тон F8, R10; сед F4, P8', via:'Тон C7 в час активности мер.' } /* i18n-ok */
  },
  Gi:{
    ex:{ ms_d:'Сед P5 (3–5 ч), тон E41 (9–11 ч)', ms_y:'Сед P5 (3–5 ч), тон V67 (17–19 ч)', big:'Сед Gi6 (ло-пункт), тон P9 (т-пособник)', hw:'Тон iG3 или TR3', nm:'Тон R7', ushu:'Тон Gi2, сед Gi11', usin:'Сед Gi2, V66; тон Gi5, iG5', via:'Сед E41 в следующие 2 ч активности мер.' }, /* i18n-ok */
    def:{ ms_d:'Тон P9 (5–7 ч), сед E45 (7–9 ч)', ms_y:'Тон P9 (5–7 ч), сед V65 (15–17 ч)', big:'Сед P7 (ло-пункт), тон Gi4 (т-пособник)', hw:'Сед iG8 или TR10', nm:'Сед R1', ushu:'Сед Gi2, тон Gi11', usin:'Тон Gi11, E36; сед Gi5, iG5', via:'Тон V65 в час активности мер.' } /* i18n-ok */
  },
  iG:{
    ex:{ ms_d:'Сед C7 (11–13 ч), тон V67 (17–19 ч)', ms_y:'Сед C7 (11–13 ч), тон E41 (9–11 ч)', big:'Сед iG7 (ло-пункт), тон C7 (т-пособник)', hw:'Тон V67', nm:'Тон F8', ushu:'Тон iG8, сед iG1', usin:'Сед iG8, E36; тон iG2, V66', via:'Сед VB43 в следующие 2 ч активности мер.' }, /* i18n-ok */
    def:{ ms_d:'Тон C9 (13–15 ч), сед V65 (15–17 ч)', ms_y:'Тон C9 (13–15 ч), сед E45 (7–9 ч)', big:'Сед C5 (ло-пункт), тон iG4 (т-пособник)', hw:'Сед V65', nm:'Сед F2', ushu:'Сед iG8, тон iG1', usin:'Тон iG3, VB41; сед iG2, V66', via:'Тон E45 в час активности мер.' } /* i18n-ok */
  },
  MC:{
    ex:{ ms_d:'Сед R1, R2 (17–19 ч), тон TR3 (23–1 ч)', ms_y:'Сед F2 (1–3 ч), тон TR3 (23–1 ч)', big:'Сед MC6 (ло-пункт), тон TR4 (т-пособник)', hw:'Тон R7', nm:'Тон E41', ushu:'Тон MC3, сед MC8', usin:'Сед MC7, RP3; тон MC3, R10', via:'Сед F8 в следующие 2 ч активности мер.' }, /* i18n-ok */
    def:{ ms_d:'Тон R7 (19–21 ч), сед TR10 (21–23 ч)', ms_y:'Тон F8 (3–5 ч), сед TR10 (21–23 ч)', big:'Сед TR5 (ло-пункт), тон MC7 (т-пособник)', hw:'Сед R1, R2', nm:'Сед E45', ushu:'Сед MC3, тон MC8', usin:'Тон MC9, F1; сед MC3, R10', via:'Тон RP5 в час активности мер.' } /* i18n-ok */
  },
  P:{
    ex:{ ms_d:'Сед F2 (1–3 ч), тон Gi11 (7–9 ч)', ms_y:'Сед RP5 (9–11 ч), тон Gi11 (7–9 ч)', big:'Сед P7 (ло-пункт), тон Gi4 (т-пособник)', hw:'Тон C9 или MC9', nm:'Тон V67', ushu:'Тон P5, сед P9', usin:'Сед P5, R10; тон P10, C8', via:'Сед RP2 в следующие 2 ч активности мер.' }, /* i18n-ok */
    def:{ ms_d:'Тон F8 (3–5 ч), сед Gi2 (5–7 ч)', ms_y:'Тон RP2 (11–13 ч), сед Gi2 (5–7 ч)', big:'Сед Gi6 (ло-пункт), тон P9 (т-пособник)', hw:'Сед C7 или MC7', nm:'Сед V65', ushu:'Сед P5, тон P9', usin:'Тон P9, RP3; сед P10, C8', via:'Тон R1 в час активности мер.' } /* i18n-ok */
  },
  R:{
    ex:{ ms_d:'Сед V65 (15–17 ч), тон MC9 (21–23 ч)', ms_y:'Сед P5 (3–5 ч), тон MC9 (21–23 ч)', big:'Сед R4 (ло-пункт), тон V64 (т-пособник)', hw:'Тон RP2', nm:'Тон Gi11', ushu:'Тон R10, сед R2', usin:'Сед R1, F1; тон R5, RP3', via:'Сед P9 в следующие 2 ч активности мер.' }, /* i18n-ok */
    def:{ ms_d:'Тон V67 (17–19 ч), сед MC7 (19–21 ч)', ms_y:'Тон P9 (5–7 ч), сед MC7 (19–21 ч)', big:'Сед V58 (ло-пункт), тон R3 (т-пособник)', hw:'Сед RP5', nm:'Сед Gi2', ushu:'Сед R10, тон R2', usin:'Тон R7, P8; сед RP3, R5', via:'Тон F2 в час активности мер.' } /* i18n-ok */
  },
  RP:{
    ex:{ ms_d:'Сед E45 (7–9 ч), тон C9 (13–15 ч)', ms_y:'Сед E45 (7–9 ч), тон P9 (5–7 ч)', big:'Сед RP4 (ло-пункт), тон E42 (т-пособник)', hw:'Тон F8', nm:'Тон TR3', ushu:'Тон RP3, сед RP5', usin:'Сед RP5, P8; тон RP1, F1', via:'Сед C9 в следующие 2 ч активности мер.' }, /* i18n-ok */
    def:{ ms_d:'Тон E41 (9–11 ч), сед C7 (11–13 ч)', ms_y:'Тон E41 (9–11 ч), сед P5 (3–5 ч)', big:'Сед E40 (ло-пункт), тон RP3 (т-пособник)', hw:'Сед F2', nm:'Сед TR10', ushu:'Сед RP3, тон RP5', usin:'Тон RP2, C8; сед RP1, F1', via:'Тон P5 в час активности мер.' } /* i18n-ok */
  },
  TR:{
    ex:{ ms_d:'Сед MC7 (19–21 ч), тон VB43 (1–3 ч)', ms_y:'Сед F2 (1–3 ч), тон VB43 (1–3 ч)', big:'Сед TR5 (ло-пункт), тон MC7 (т-пособник)', hw:'Тон V67', nm:'Тон RP2', ushu:'Тон TR10, сед TR6', usin:'Сед TR10, E36; тон TR2, V66', via:'Сед VB43 в следующие 2 ч активности мер.' }, /* i18n-ok */
    def:{ ms_d:'Тон MC9 (21–23 ч), сед VB38 (23–1 ч)', ms_y:'Тон F8 (3–5 ч), сед VB38 (23–1 ч)', big:'Сед MC6 (ло-пункт), тон TR4 (т-пособник)', hw:'Сед V65', nm:'Сед RP5', ushu:'Сед TR10, тон TR6', usin:'Тон TR3, VB41; сед TR2, V66', via:'Тон E45 в час активности мер.' } /* i18n-ok */
  },
  V:{
    ex:{ ms_d:'Сед iG8 (13–15 ч), тон R7 (19–21 ч)', ms_y:'Сед Gi2 (5–7 ч), тон R7 (19–21 ч)', big:'Сед V58 (ло-пункт), тон R3 (т-пособник)', hw:'Тон E41', nm:'Тон P9', ushu:'Тон V66, сед V65', usin:'Сед V65, VB41; тон V40, E36', via:'Сед Gi11 в следующие 2 ч активности мер.' }, /* i18n-ok */
    def:{ ms_d:'Тон iG3 (15–17 ч), сед R1, R2 (17–19 ч)', ms_y:'Тон Gi11 (7–9 ч), сед R1, R2 (17–19 ч)', big:'Сед R4 (ло-пункт), тон V64 (т-пособник)', hw:'Сед E45', nm:'Сед P5', ushu:'Сед V66, тон V65', usin:'Тон V67, Gi1; сед E36, V40', via:'Тон VB43 в час активности мер.' } /* i18n-ok */
  },
  VB:{
    ex:{ ms_d:'Сед TR10 (21–23 ч), тон F8 (3–5 ч)', ms_y:'Сед V65 (15–17 ч), тон F8 (3–5 ч)', big:'Сед VB37 (ло-пункт), тон F3 (т-пособник)', hw:'Тон Gi11', nm:'Тон C9', ushu:'Тон VB34, сед VB38', usin:'Сед VB38, iG5; тон VB44, Gi1', via:'Сед V67 в следующие 2 ч активности мер.' }, /* i18n-ok */
    def:{ ms_d:'Тон TR3 (23–1 ч), сед F2 (1–3 ч)', ms_y:'Тон V67 (17–19 ч), сед F2 (1–3 ч)', big:'Сед F5 (ло-пункт), тон VB40 (т-пособник)', hw:'Сед Gi2, Gi3', nm:'Сед C7', ushu:'Сед VB34, тон VB38', usin:'Тон VB43, V66; сед VB44, Gi1', via:'Тон iG8 в час активности мер.' } /* i18n-ok */
  },
};

// Дистальные точки: ex=избыток, def=недостаток; m=местные, tz=точечные /* i18n-ok */
export const DIST = {
  C:{  ex:{ m:'(C7, RP5) — сед, iG3 — тон',           tz:'(C7, C4, V15) — сед, VC14 — тон' }, /* i18n-ok */
       def:{ m:'(C9, C7, F8, RP2) — тон, iG8 — сед',   tz:'(C9, C7, C3, VC14) — тон, V15 — сед' } }, /* i18n-ok */
  E:{  ex:{ m:'(E45, E42, Gi2) — сед, RP2 — тон',       tz:'(E45, E42, E44, V21) — сед, VC12 — тон' }, /* i18n-ok */
       def:{ m:'(E41, E42, TR3, Gi11) — тон, RP5 — сед', tz:'(E41, E42, E43, VC12) — тон, V21 — сед' } }, /* i18n-ok */
  F:{  ex:{ m:'(F2, F3, C7, VB38) — сед, P9 — тон',     tz:'(F2, F3, V18) — сед, F14 — тон' }, /* i18n-ok */
       def:{ m:'(F8, F3, R7, VB43) — тон, P5 — сед',    tz:'(F8, F3, F4, F14) — тон, V18 — сед' } }, /* i18n-ok */
  Gi:{ ex:{ m:'(Gi2, Gi4, V65, P5) — сед, E41 — тон',   tz:'(Gi2, Gi4, Gi3, V25) — сед, E25 — тон' }, /* i18n-ok */
       def:{ m:'(Gi11, Gi4, E41, P9) — тон, E45 — сед',  tz:'(Gi11, Gi4, Gi5, E25) — тон, V25 — сед' } }, /* i18n-ok */
  iG:{ ex:{ m:'(iG8, iG4, E45, C7) — сед, V67 — тон',   tz:'(iG8, iG4, iG1, V27) — сед, VC4 — тон' }, /* i18n-ok */
       def:{ m:'(iG3, iG4, VB43, C9) — тон, V65 — сед',  tz:'(iG3, iG4, iG2, VC4) — тон, V27 — сед' } }, /* i18n-ok */
  MC:{ ex:{ m:'(MC7, RP5, R1) — сед, TR3 — тон',         tz:'(MC7, MC5, V14) — сед, MC1 — тон' }, /* i18n-ok */
       def:{ m:'(MC9, MC7, F8, R7) — тон, TR10 — сед',   tz:'(MC9, MC7, MC3, MC1) — тон, V14 — сед' } }, /* i18n-ok */
  P:{  ex:{ m:'(P5, P9, R1, F2) — сед, Gi11 — тон',      tz:'(P5, P9, P11, V13) — сед, P1 — тон' }, /* i18n-ok */
       def:{ m:'(P9, RP2, F8) — тон, Gi2 — сед',          tz:'(P9, P10, P1) — тон, V13 — сед' } }, /* i18n-ok */
  R:{  ex:{ m:'(R1, R3, F2, V65) — сед, MC9 — тон',      tz:'(R1, R2, R3, V23) — сед, VB25 — тон' }, /* i18n-ok */
       def:{ m:'(R7, R3, P9, V67) — тон, MC7 — сед',     tz:'(R7, R3, VB25) — тон, V23 — сед' } }, /* i18n-ok */
  RP:{ ex:{ m:'(RP5, RP3, P5, E45) — сед, C9 — тон',     tz:'(RP5, RP3, RP9, V20) — сед, F13 — тон' }, /* i18n-ok */
       def:{ m:'(RP2, RP3, MC9, E41) — тон, C7 — сед',   tz:'(RP2, RP3, RP1, F13) — тон, V20 — сед' } }, /* i18n-ok */
  TR:{ ex:{ m:'(TR10, TR4, E45, MC7) — сед, VB43 — тон',  tz:'(TR10, TR4, TR1, V22) — сед, VC5 — тон' }, /* i18n-ok */
       def:{ m:'(TR3, TR4, VB43, MC9) — тон, MC7 — сед', tz:'(TR3, TR4, TR2, VC5) — тон, V22 — сед' } }, /* i18n-ok */
  V:{  ex:{ m:'(V65, V64, VB38, iG8) — сед, R7 — тон',   tz:'(V65, V64, V60, V28) — сед, VC3 — тон' }, /* i18n-ok */
       def:{ m:'(V67, V64, Gi11, iG3) — тон, R1 — сед',   tz:'(V67, V64, V40, VC3) — тон, V28 — сед' } }, /* i18n-ok */
  VB:{ ex:{ m:'(VB38, VB40, iG8, TR10) — сед, F8 — тон',  tz:'(VB38, VB40, VB34, V19) — сед, VB24 — тон' }, /* i18n-ok */
       def:{ m:'(VB43, VB40, V67, TR3) — тон, F2 — сед',   tz:'(VB43, VB40, VB44, VB24) — тон, V19 — сед' } }, /* i18n-ok */
};

export function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

let _idSeq = 0;
export function uniqueId() {
  // Date.now()*1000 + counter: уникален внутри сессии, не коллидирует даже при одновременных вызовах
  return Date.now() * 1000 + (_idSeq++ % 1000);
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      alert(t('errors:storage.quotaExceeded'));
    }
    return false;
  }
}

export function safeGetRecords() {
  try { return JSON.parse(localStorage.getItem('acutwin_records')) || []; } catch { return []; }
}

export function parseSyms(text) {
  return text.split(',').map(s => s.trim()).filter(s => s.length > 2);
}

export function ptVideoSrc(code) {
  const m = code.match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return '';
  return `../media/pts/${m[1]}/${m[1]}${m[2]}.mp4`;
}

export function merVideoSrc(mer) {
  return `../media/mer/mer_${mer}.mp4`;
}

export function extractPoints(text) {
  return (text || '').match(/[A-Za-z]{1,4}\d{1,3}/g) || [];
}

// Конвертирует внутренние коды → французская нотация для отображения
// Gi→GI, iG→IG, T→VG, J→VC
export function displayCode(code) {
  if (!code) return code;
  return code
    .replace(/^Gi(\d)/, 'GI$1')
    .replace(/^iG(\d)/, 'IG$1')
    .replace(/^T(\d)/,  'VG$1')
    .replace(/^J(\d)/,  'VC$1');
}

const NAV_I18N = {
  index:    'common:nav.newVisit',
  schedule: 'common:nav.schedule',
  treatment:'common:nav.treatment',
  atlas:    'common:nav.atlas',
  history:  'common:nav.history',
  video:    'common:nav.video',
  profile:  'common:nav.profile',
  admin:    'common:nav.admin',
};

export function buildSidebar(activePage, session) {
  const isAdmin = session && session.role === 'admin';
  const items = isAdmin ? [
    { id:'index',     href:'index.html',       icon:'edit_calendar',        label:'Новый приём' /* i18n-ok */ },
    { id:'schedule',  href:'schedule.html',    icon:'calendar_month',       label:'Расписание' /* i18n-ok */ },
    { id:'treatment', href:'treatment.html',   icon:'medical_services',     label:'Тактика лечения' /* i18n-ok */ },
    { id:'atlas',     href:'atlas.html',       icon:'menu_book',            label:'Атлас точек' /* i18n-ok */ },
    { id:'history',   href:'history.html',     icon:'history',              label:'История приёмов' /* i18n-ok */ },
    { id:'video',     href:'video.html',       icon:'play_circle',          label:'Видеообучение' /* i18n-ok */ },
    { id:'divider' },
    { id:'profile',   href:'profile.html',     icon:'badge',                label:'Профиль' /* i18n-ok */ },
    { id:'admin',     href:'admin.html',       icon:'admin_panel_settings', label:'Клиенты и оплата' /* i18n-ok */ },
  ] : [
    { id:'index',     href:'index.html',     icon:'edit_calendar',    label:'Новый приём' /* i18n-ok */ },
    { id:'schedule',  href:'schedule.html',  icon:'calendar_month',   label:'Расписание' /* i18n-ok */ },
    { id:'treatment', href:'treatment.html',  icon:'medical_services', label:'Тактика лечения' /* i18n-ok */ },
    { id:'atlas',     href:'atlas.html',      icon:'menu_book',        label:'Атлас точек' /* i18n-ok */ },
    { id:'history',   href:'history.html',    icon:'history',          label:'История приёмов' /* i18n-ok */ },
    { id:'video',     href:'video.html',      icon:'play_circle',      label:'Видеообучение' /* i18n-ok */ },
    { id:'divider' },
    { id:'profile',   href:'profile.html',    icon:'badge',            label:'Профиль' /* i18n-ok */ },
  ];
  const doctorBlock = session ? `
    <div class="px-4 py-3 border-t border-white/10 flex items-center gap-2 flex-shrink-0">
      <span class="material-symbols-outlined text-[#8b90a0]" style="font-size:18px;zoom:1">stethoscope</span>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-semibold text-[#e2e2e2] truncate">${esc(session.name)}</div>
        <div class="text-[10px] text-[#8b90a0]">${esc(session.username)}</div>
      </div>
      <button onclick="window._logoutConfirm && window._logoutConfirm()"
        class="flex items-center gap-1 px-2 py-1 rounded-lg text-[#8b90a0] hover:text-[#ffb4ab] hover:bg-[#ffb4ab]/10 transition-colors text-xs font-medium"
        data-i18n-title="auth:login.logout" title="${t('auth:login.logout')}">
        <span class="material-symbols-outlined" style="font-size:16px;zoom:1">logout</span>
        <span data-i18n="auth:login.logout">${t('auth:login.logout')}</span>
      </button>
    </div>` : '';
  return `
    <aside id="sidebar"
      class="fixed left-0 top-0 h-screen w-64 flex flex-col z-50
             bg-[#0e0e0e]/95 backdrop-blur-2xl border-r border-white/10">
      <div class="px-4 py-3 flex items-center justify-between border-b border-white/10"
           onclick="window._showAbout && window._showAbout()"
           style="cursor:pointer;transition:background 0.18s"
           onmouseenter="this.style.background='rgba(0,242,255,0.06)'"
           onmouseleave="this.style.background=''">
        <div class="flex items-center gap-2">
          <div>
            <h1 class="text-base font-bold text-[#00F2FF] tracking-tight leading-tight"
                style="font-family:'Hanken Grotesk',sans-serif">AcuTwin</h1>
            <p class="text-[10px] text-[#c1c6d7] uppercase tracking-wider" data-i18n="common:brand.tagline">${t('common:brand.tagline')}</p>
          </div>
        </div>
        <img src="vitruvian-digital.png" alt="Digital Twin"
             style="height:5rem;width:5rem;object-fit:cover;border-radius:8px;opacity:0.9;flex-shrink:0"/>
      </div>
      <div class="flex-1 overflow-y-auto min-h-0 flex flex-col">
      <nav class="flex flex-col py-3 px-2 gap-0.5">
        ${items.map(i => i.id === 'divider'
          ? `<div style="height:1px;background:rgba(255,255,255,0.08);margin:6px 8px"></div>`
          : `<a href="${i.href}"
             class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200
                    ${activePage===i.id
                      ? 'bg-[#00F2FF]/10 text-[#00F2FF] border-r-2 border-[#00F2FF]'
                      : 'text-[#c1c6d7] hover:bg-white/15 hover:text-white'}"
          >
            <span class="material-symbols-outlined text-xl">${i.icon}</span>
            <span style="font-family:'Inter',sans-serif;font-weight:600" data-i18n="${NAV_I18N[i.id] || ''}">${NAV_I18N[i.id] ? t(NAV_I18N[i.id]) : i.label}</span>
          </a>`).join('')}
      </nav>
      <div style="padding:5px 16px 4px;display:flex;justify-content:center;margin-top:auto">
        <img src="wuxing.png" alt="${t('common:wuxing.name')}"
             style="width:150px;height:150px;object-fit:cover;border-radius:50%;
                    opacity:0.95;
                    filter:saturate(1.3) brightness(1.13) contrast(1.1);
                    box-shadow:0 0 32px rgba(0,242,255,0.2)"/>
      </div>
      <div style="padding:0 10px 8px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px">
          <div id="ec-metal"  style="border-radius:8px;border:1px solid #5a8fa855;background:#5a8fa810;padding:6px 3px 5px;text-align:center;transition:all 0.5s;opacity:0.5">
            <div style="font-size:10px;font-weight:700;color:#5a8fa8;line-height:1.3">${t('common:wuxing.metal')}</div>
            <div style="font-size:9px;color:#8b90a0;line-height:1.4">P · Gi</div>
            <div style="font-size:7.5px;color:#90c8e0;line-height:1.3">3–5 · 5–7</div>
          </div>
          <div id="ec-earth"  style="border-radius:8px;border:1px solid #c0784055;background:#c0784010;padding:6px 3px 5px;text-align:center;transition:all 0.5s;opacity:0.5">
            <div style="font-size:10px;font-weight:700;color:#c07840;line-height:1.3">${t('common:wuxing.earth')}</div>
            <div style="font-size:9px;color:#8b90a0;line-height:1.4">E · RP</div>
            <div style="font-size:7.5px;color:#f0a060;line-height:1.3">7–9 · 9–11</div>
          </div>
          <div id="ec-fire"   style="border-radius:8px;border:1px solid #c0392b55;background:#c0392b10;padding:6px 3px 5px;text-align:center;transition:all 0.5s;opacity:0.5">
            <div style="font-size:10px;font-weight:700;color:#c0392b;line-height:1.3">${t('common:wuxing.fire')}</div>
            <div style="font-size:9px;color:#8b90a0;line-height:1.4">C · iG</div>
            <div style="font-size:7.5px;color:#f07060;line-height:1.3">11–13 · 13–15</div>
          </div>
          <div id="ec-water"  style="border-radius:8px;border:1px solid #2471a355;background:#2471a310;padding:6px 3px 5px;text-align:center;transition:all 0.5s;opacity:0.5">
            <div style="font-size:10px;font-weight:700;color:#2471a3;line-height:1.3">${t('common:wuxing.water')}</div>
            <div style="font-size:9px;color:#8b90a0;line-height:1.4">V · R</div>
            <div style="font-size:7.5px;color:#50a0d8;line-height:1.3">15–17 · 17–19</div>
          </div>
          <div id="ec-fire2"  style="border-radius:8px;border:1px solid #a0305a55;background:#a0305a10;padding:6px 3px 5px;text-align:center;transition:all 0.5s;opacity:0.5">
            <div style="font-size:10px;font-weight:700;color:#a0305a;line-height:1.3">${t('common:wuxing.fire2')}</div>
            <div style="font-size:9px;color:#8b90a0;line-height:1.4">MC · TR</div>
            <div style="font-size:7.5px;color:#d06090;line-height:1.3">19–21 · 21–23</div>
          </div>
          <div id="ec-wood"   style="border-radius:8px;border:1px solid #3d8a5c55;background:#3d8a5c10;padding:6px 3px 5px;text-align:center;transition:all 0.5s;opacity:0.5">
            <div style="font-size:10px;font-weight:700;color:#3d8a5c;line-height:1.3">${t('common:wuxing.wood')}</div>
            <div style="font-size:9px;color:#8b90a0;line-height:1.4">VB · F</div>
            <div style="font-size:7.5px;color:#60c080;line-height:1.3">23–1 · 1–3</div>
          </div>
        </div>
      </div>
      </div>
      ${doctorBlock}
    </aside>
    <nav id="mobile-nav">
      ${items.filter(i => i.id !== 'divider').map(i => `
        <a href="${i.href}" class="${activePage===i.id ? 'mob-active' : ''}">
          <span class="material-symbols-outlined">${i.icon}</span>
          <span data-i18n="${NAV_I18N[i.id] || ''}">${NAV_I18N[i.id] ? t(NAV_I18N[i.id]) : i.label}</span>
        </a>`).join('')}
    </nav>`;
}

const _EC = {
  metal: { hours:[3,4,5,6],    color:'#5a8fa8' },
  earth: { hours:[7,8,9,10],   color:'#c07840' },
  fire:  { hours:[11,12,13,14],color:'#c0392b' },
  water: { hours:[15,16,17,18],color:'#2471a3' },
  fire2: { hours:[19,20,21,22],color:'#a0305a' },
  wood:  { hours:[23,0,1,2],   color:'#3d8a5c' },
};

// ── Модальное окно «О программе» ──────────────────────────
const _litIntroText = 'Рефлексотерапия — живая традиция, которой тысячи лет. При разработке AcuTwin мы опирались на труды, ставшие фундаментом современной практики:'; /* i18n-ok */
const _aboutFeatures = [
  ['🧭', 'Меридиональная диагностика', 'Введите симптомы — система за секунды определяет поражённые меридианы и предлагает тактику лечения.'], /* i18n-ok */
  ['☯️', 'У-Син диагностика', 'Учитывает пол, время суток и сезон. Рекомендации по всем канонам традиционной китайской медицины.'], /* i18n-ok */
  ['📋', 'Готовые рецепты по диагнозу', 'Протокол с точками и техникой введения. Видео по каждой точке и меридиану. Печать бланка в один клик.'], /* i18n-ok */
  ['🗂️', 'Карточка пациента', 'Все приёмы и назначения в одном месте. Доступно с любого устройства в любой момент.'], /* i18n-ok */
  ['🎬', 'Атлас точек с видео', 'Справочник всех акупунктурных точек с описаниями, показаниями и обучающими видео.'], /* i18n-ok */
];
const _aboutPromo = 'Аналогов на русском языке не существует.<br>Первый в мире диагностический инструмент для рефлексотерапевта.'; /* i18n-ok */
const _aboutDisclaimer = 'Только для специалистов с медицинским образованием. Не заменяет консультацию врача и не является основанием для самолечения. Применение методов рефлексотерапии должно осуществляться в соответствии с действующими клиническими протоколами.'; /* i18n-ok */
window._showAbout = function() {
  if (document.getElementById('about-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'about-modal';

  let clinicName = '';
  try {
    const token = sessionStorage.getItem('acutwin_token');
    if (token) {
      const b64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const bin = atob(b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '='));
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      const payload = JSON.parse(new TextDecoder().decode(bytes));
      clinicName = payload.clinicName || '';
    }
  } catch {}

  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,0.72);backdrop-filter:blur(6px);
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;

  const TAB_ACTIVE = 'background:#00F2FF15;color:#00F2FF;border-color:#00F2FF';
  const TAB_IDLE   = 'background:none;color:#8b90a0;border-color:transparent';

  const litItems = [
    { group: 'Серия «Китайская чжэньцзю-терапия»', books: [ /* i18n-ok */
      'Теоретические основы китайской медицины', /* i18n-ok */
      'Методы и техники чжэньцзю-терапии', /* i18n-ok */
      'Система каналов и коллатералей китайской медицины', /* i18n-ok */
      'Акупунктурные точки китайской чжэньцзю-терапии', /* i18n-ok */
      'Лечение болезней методами чжэньцзю-терапии', /* i18n-ok */
    ]},
    { group: 'Классические трактаты', books: [ /* i18n-ok */
      'Трактат Жёлтого Императора о внутреннем: Ось Духа', /* i18n-ok */
      'Су Вэнь, Нэй Цзин — трактат по традиционной китайской медицине', /* i18n-ok */
    ]},
    { group: 'Авторские издания', books: [ /* i18n-ok */
      'Д.М. Табеева — Практическое руководство по иглорефлексотерапии', /* i18n-ok */
      'Д.М. Табеева — Иглотерапия: интегративный подход', /* i18n-ok */
      'Жорж Сулье де Моран — Китайская акупунктура: Энергия, манипуляция, физиология', /* i18n-ok */
      'Жорж Сулье де Моран — Китайская акупунктура: Болезни и их лечение', /* i18n-ok */
      'Жорж Сулье де Моран — Китайская акупунктура: Меридианы, точки и их эффекты', /* i18n-ok */
      'В.Д. Молостов — Практическое руководство по лечению заболеваний', /* i18n-ok */
      'Гаваа Лувсан — Традиционные и современные аспекты восточной рефлексотерапии', /* i18n-ok */
      'Клаус К. Шнорренбергер — Терапия акупунктурой. Том 1', /* i18n-ok */
      'Клаус К. Шнорренбергер — Терапия акупунктурой. Том 2', /* i18n-ok */
      'Клаус Шнорренбергер — Учебник китайской медицины для западных врачей', /* i18n-ok */
    ]},
  ];

  const litHtml = `
    <div style="font-size:0.82rem;color:#94a3b8;line-height:1.6;margin-bottom:14px;
                padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.07);
                font-style:italic">
      ${_litIntroText}
    </div>
  ` + litItems.map(g => `
    <div style="font-size:0.68rem;color:#cbd5e1;text-transform:uppercase;
                letter-spacing:.06em;margin:10px 0 6px">${g.group}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px">
    ${g.books.map(b => `
      <div style="color:#94a3b8;font-size:0.75rem;padding:3px 0 3px 10px;
                  border-left:2px solid rgba(0,242,255,0.25);
                  line-height:1.35">${b}</div>
    `).join('')}
    </div>
  `).join('');

  modal.innerHTML = `
    <div style="background:#111827;border:1px solid rgba(0,242,255,0.2);border-radius:18px;
                max-width:520px;width:100%;padding:28px 32px;position:relative;
                box-shadow:0 0 60px rgba(0,242,255,0.08);
                max-height:85vh;overflow-y:auto">
      <button onclick="document.getElementById('about-modal').remove()"
              style="position:absolute;top:16px;right:18px;background:none;border:none;
                     color:#8b90a0;font-size:22px;cursor:pointer;line-height:1">×</button>

      <!-- Шапка -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <img src="vitruvian-digital.png" style="width:46px;height:46px;border-radius:10px;opacity:0.9"/>
        <div>
          <div style="font-size:1.2rem;font-weight:800;color:#00F2FF;
                      font-family:'Hanken Grotesk',sans-serif">AcuTwin</div>
          <div style="font-size:0.72rem;color:#8b90a0;text-transform:uppercase;
                      letter-spacing:.08em">${t('common:brand.subtitle')}</div>
          ${clinicName ? `<div style="margin-top:5px;font-size:0.82rem;color:#e2e8f0;font-weight:600">${clinicName}</div>` : ''}
        </div>
      </div>

      <!-- Вкладки -->
      <div style="display:flex;gap:6px;margin-bottom:20px">
        <button id="tab-features" onclick="
          document.getElementById('pane-features').style.display='block';
          document.getElementById('pane-lit').style.display='none';
          document.getElementById('pane-disc').style.display='none';
          document.getElementById('tab-features').style.cssText+=';${TAB_ACTIVE}';
          document.getElementById('tab-lit').style.cssText+=';${TAB_IDLE}';
          document.getElementById('tab-disc').style.cssText+=';${TAB_IDLE}';
        " style="flex:1;padding:7px 0;border-radius:8px;border:1px solid;cursor:pointer;
                 font-size:0.82rem;font-family:inherit;transition:all .18s;${TAB_ACTIVE}">
          ${t('common:about.tabs.features')}
        </button>
        <button id="tab-lit" onclick="
          document.getElementById('pane-features').style.display='none';
          document.getElementById('pane-lit').style.display='block';
          document.getElementById('pane-disc').style.display='none';
          document.getElementById('tab-lit').style.cssText+=';${TAB_ACTIVE}';
          document.getElementById('tab-features').style.cssText+=';${TAB_IDLE}';
          document.getElementById('tab-disc').style.cssText+=';${TAB_IDLE}';
        " style="flex:1;padding:7px 0;border-radius:8px;border:1px solid;cursor:pointer;
                 font-size:0.82rem;font-family:inherit;transition:all .18s;${TAB_IDLE}">
          ${t('common:about.tabs.literature')}
        </button>
        <button id="tab-disc" onclick="
          document.getElementById('pane-features').style.display='none';
          document.getElementById('pane-lit').style.display='none';
          document.getElementById('pane-disc').style.display='block';
          document.getElementById('tab-disc').style.cssText+=';${TAB_ACTIVE}';
          document.getElementById('tab-features').style.cssText+=';${TAB_IDLE}';
          document.getElementById('tab-lit').style.cssText+=';${TAB_IDLE}';
        " style="flex:1;padding:7px 0;border-radius:8px;border:1px solid;cursor:pointer;
                 font-size:0.82rem;font-family:inherit;transition:all .18s;${TAB_IDLE}">
          ${t('common:about.tabs.disclaimer')}
        </button>
      </div>

      <!-- Вкладка: Возможности -->
      <div id="pane-features">
        <div style="display:flex;flex-direction:column;gap:13px">
          ${_aboutFeatures.map(([icon,title,desc]) => `
            <div style="display:flex;gap:12px;align-items:flex-start">
              <span style="font-size:1.2rem;flex-shrink:0">${icon}</span>
              <div>
                <div style="color:#e2e8f0;font-weight:700;font-size:0.9rem;margin-bottom:2px">${title}</div>
                <div style="color:#8b90a0;font-size:0.8rem;line-height:1.5">${desc}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.07);
                    text-align:center;color:#c8d8f0;font-size:0.76rem;line-height:1.6">
          ${_aboutPromo}
        </div>
      </div>

      <!-- Вкладка: Литература -->
      <div id="pane-lit" style="display:none">
        ${litHtml}
      </div>

      <!-- Вкладка: Важно / Дисклеймер -->
      <div id="pane-disc" style="display:none">
        <div style="display:flex;gap:14px;align-items:flex-start;padding:18px;
                    background:rgba(255,180,0,0.06);border:1px solid rgba(255,180,0,0.2);
                    border-radius:12px">
          <span style="font-size:1.6rem;flex-shrink:0;line-height:1">⚠️</span>
          <p style="color:#94a3b8;font-size:0.85rem;line-height:1.7;margin:0">
            ${_aboutDisclaimer}
          </p>
        </div>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
};

export function initElementClock() {
  function tick() {
    const h = new Date().getHours();
    Object.entries(_EC).forEach(([id, cfg]) => {
      const el = document.getElementById('ec-' + id);
      if (!el) return;
      const active = cfg.hours.includes(h);
      el.style.opacity     = active ? '1'              : '0.5';
      el.style.borderColor = active ? cfg.color + 'cc' : cfg.color + '55';
      el.style.background  = active ? cfg.color + '25' : cfg.color + '10';
      el.style.boxShadow   = active ? '0 0 8px ' + cfg.color + '60' : 'none';
    });
  }
  tick();
  setInterval(tick, 60000);
}

// ── Мобильная кнопка пользователя в шапке ─────────────────
function _injectMobileUser() {
  const header = document.querySelector('header');
  if (!header || document.getElementById('mob-user-btn')) return;
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem('acutwin_session')); } catch {}
  if (!session) return;
  const initials = (session.name || session.username)
    .split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const wrap = document.createElement('div');
  wrap.id = 'mob-user-btn';
  wrap.style.cssText = 'display:none;margin-left:auto;position:relative;flex-shrink:0';
  wrap.innerHTML = `
    <button id="mob-user-avatar"
      onclick="document.getElementById('mob-user-panel').classList.toggle('mob-panel-open')"
      style="width:36px;height:36px;border-radius:50%;
             background:rgba(0,242,255,0.15);border:1.5px solid rgba(0,242,255,0.4);
             color:#00F2FF;font-weight:700;font-size:12px;cursor:pointer;
             display:flex;align-items:center;justify-content:center;flex-shrink:0">
      ${initials}
    </button>
    <div id="mob-user-panel"
      style="display:none;position:absolute;top:calc(100% + 8px);right:0;z-index:9999;
             background:#1f1f1f;border:1px solid #414755;border-radius:12px;
             padding:14px 16px;min-width:190px;box-shadow:0 8px 32px rgba(0,0,0,0.6)">
      <div style="font-size:13px;font-weight:600;color:#e2e2e2;margin-bottom:2px;white-space:nowrap">${esc(session.name)}</div>
      <div style="font-size:11px;color:#8b90a0;margin-bottom:14px">${esc(session.username)}</div>
      <button onclick="window._logoutConfirm && window._logoutConfirm()"
        data-i18n-title="auth:login.logout" title="${t('auth:login.logout')}"
        style="width:100%;padding:9px 12px;background:rgba(255,180,171,0.1);
               border:1px solid rgba(255,180,171,0.3);border-radius:8px;
               color:#ffb4ab;font-size:13px;font-weight:600;cursor:pointer;
               display:flex;align-items:center;gap:8px">
        <span class="material-symbols-outlined" style="font-size:16px;zoom:1">logout</span>
        <span data-i18n="auth:login.logout">${t('auth:login.logout')}</span>
      </button>
    </div>`;
  // Закрытие панели при клике вне
  document.addEventListener('click', e => {
    const panel = document.getElementById('mob-user-panel');
    if (!panel) return;
    if (!wrap.contains(e.target)) panel.classList.remove('mob-panel-open');
  });
  header.appendChild(wrap);
}

// mob-panel-open управляет видимостью панели
document.addEventListener('click', () => {}); // dummy to ensure listener attached
const _mobUserStyle = document.createElement('style');
_mobUserStyle.textContent = `
  #mob-user-panel.mob-panel-open { display: block !important; }
`;
document.head && document.head.appendChild(_mobUserStyle);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _injectMobileUser);
} else {
  _injectMobileUser();
}
