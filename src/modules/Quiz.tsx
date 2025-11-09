import { useMemo, useState } from "react";

type Q = {
  text: string;
  options: string[];
  correct: number;
  explain: string;
};

type ShuffledQ = Q;

function shuffleArray<T>(src: T[]): T[] {
  const a = src.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleQuestion(q: Q): ShuffledQ {
  const idx = q.options.map((_, i) => i);
  const shuffledIdx = shuffleArray(idx);
  const options = shuffledIdx.map(i => q.options[i]);
  const correct = shuffledIdx.indexOf(q.correct);
  return { text: q.text, options, correct, explain: q.explain };
}

function buildQuiz(base: Q[]): ShuffledQ[] {
  const withShuffledOptions = base.map(shuffleQuestion);
  return shuffleArray(withShuffledOptions);
}

const BASE_QUESTIONS: Q[] = [
  {
    text: "Какой тип DNS-записи используется для публикации SPF-политики домена?",
    options: ["MX", "TXT", "SRV", "CAA"],
    correct: 1,
    explain: "SPF публикуется в TXT-записях домена отправителя."
  },
  {
    text: "Где хранится открытый ключ DKIM?",
    options: [
      "В A-записи корня домена",
      "В TXT-записи selector._domainkey.<домен>",
      "В MX-записи",
      "В записи _dmarc.<домен>"
    ],
    correct: 1,
    explain: "Путь вида selector._domainkey.example.com (тип TXT)."
  },
  {
    text: "Какой тег DMARC задаёт жёсткую политику отклонения?",
    options: ["rua=mailto:", "pct=100", "p=reject", "adkim=s"],
    correct: 2,
    explain: "p=reject — отклонение при невыравнивании DMARC."
  },
  {
    text: "SPF=pass (НЕ выровнен), DKIM=fail. Итог DMARC?",
    options: ["pass", "fail", "temporary pass", "neutral"],
    correct: 1,
    explain: "DMARC требует выравнивания хотя бы одного механизма; если оба не выровнены — fail."
  },
  {
    text: "Где должен располагаться файл политики MTA-STS?",
    options: [
      "https://example.com/.well-known/mta-sts.txt",
      "https://mta-sts.example.com/.well-known/mta-sts.txt",
      "http://mta-sts.example.com/policy.txt",
      "dns: _mta-sts.example.com TXT “в=STSv1; mode=enforce”"
    ],
    correct: 1,
    explain: "Политика доступна по HTTPS на mta-sts.<домен> в /.well-known/mta-sts.txt."
  },
  {
    text: "Какой DNS-хост и тип записи используются для TLS-RPT?",
    options: [
      "_smtp._tls.<домен> TXT",
      "_tls._smtp.<домен> TXT",
      "_smtp._tls.<домен> CNAME",
      "_tlsrpt.<домен> TXT"
    ],
    correct: 0,
    explain: "Отчётность TLS-RPT публикуется в TXT по имени _smtp._tls.<домен>."
  },
  {
    text: "Какой признак указывает на злоупотребление OAuth-доступом почтового ящика?",
    options: [
      "Клиент запрашивает только online-доступ без refresh-токена",
      "Приложение с правами Mail.ReadWrite и offline_access без деловой необходимости",
      "Наличие DKIM-подписи у исходящей почты",
      "Использование POP3 внутри сети"
    ],
    correct: 1,
    explain: "Избыточные scope’ы у непонятного приложения — красный флаг."
  },
  {
    text: "Что является базовой мерой против BEC при изменении платёжных реквизитов?",
    options: [
      "Отправка повторного письма",
      "Двухканальная верификация через независимый канал",
      "Проверка, есть ли SPF у домена контрагента",
      "Отключение DKIM у своей почты"
    ],
    correct: 1,
    explain: "Двухканальная верификация — ключевая организационная мера."
  },
  {
    text: "Какой заголовок указывает на срабатывание транспортных правил Exchange?",
    options: [
      "X-MS-Exchange-Transport-Rules",
      "ARC-Authentication-Results",
      "X-Forwarded-For",
      "List-Unsubscribe"
    ],
    correct: 0,
    explain: "X-MS-Exchange-Transport-Rules — индикатор обработок на транспорте."
  },
  {
    text: "Что означает adkim=s в DMARC?",
    options: [
      "Строгое выравнивание DKIM по организационному домену",
      "Строгое выравнивание DKIM по точному домену (strict)",
      "Ослабленное выравнивание DKIM (relaxed)",
      "Отключение проверки DKIM"
    ],
    correct: 1,
    explain: "s = strict: домен из d= должен строго совпадать с From-доменом."
  },
  {
    text: "Как распознать возможную «внешнюю авто-переадресацию» по правилам ящика?",
    options: [
      "Действие move в папку Archive",
      "Действие forward на внешний http/mailto адрес",
      "Действие delete на письма из внутреннего домена",
      "Категоризация писем по теме meeting"
    ],
    correct: 1,
    explain: "Внешние forward’ы — частый индикатор компрометации."
  },
  {
    text: "Что значит pct=25 в DMARC?",
    options: [
      "Применять политику к 25% доменов",
      "Применять политику к 25% сообщений",
      "Снизить срок хранения отчётов до 25 дней",
      "Разрешать 25% доменов без DKIM"
    ],
    correct: 1,
    explain: "Политика применяется к доле сообщений (процент выборки)."
  },
  {
    text: "Где публикуется запись DMARC?",
    options: [
      "_dmarc.<домен> TXT",
      "_domainkey.<домен> TXT",
      "selector._dmarc.<домен> TXT",
      "_arc.<домен> TXT"
    ],
    correct: 0,
    explain: "Запись DMARC — TXT на поддомене _dmarc.<домен>."
  },
  {
    text: "Что НЕ относится к LOTS (Living Off Trusted Services)?",
    options: [
      "Злоупотребление облачными почтовыми сервисами для BEC",
      "Использование уязвимости в локальном MTA",
      "Хостинг фишинговых страниц на доверенных платформах",
      "Отправка писем через легитимные облачные SMTP"
    ],
    correct: 1,
    explain: "LOTS — эксплуатация доверенных сервисов, а не локальных уязвимостей MTA."
  },
  {
    text: "Какой базовый индикатор возможной подмены реквизитов в цепочке деловой переписки?",
    options: [
      "Резкое изменение формата счёта/инвойса",
      "Наличие SPF у домена отправителя",
      "Отсутствие заголовка List-Unsubscribe",
      "Повышение счётчика Received"
    ],
    correct: 0,
    explain: "Нетипичный формат/реквизиты — повод для двухканальной верификации."
  }
];

export default function Quiz() {
  const [questions, setQuestions] = useState<ShuffledQ[]>(() => buildQuiz(BASE_QUESTIONS));
  const [answers, setAnswers] = useState<number[]>(() => Array(BASE_QUESTIONS.length).fill(-1));
  const [submitted, setSubmitted] = useState(false);

  const score = useMemo(
    () => answers.reduce((acc, a, i) => acc + (a === questions[i]?.correct ? 1 : 0), 0),
    [answers, questions]
  );

  function choose(qi: number, oi: number) {
    const next = answers.slice();
    next[qi] = oi;
    setAnswers(next);
  }

  function submit() {
    setSubmitted(true);
  }

  function reset() {
    const rebuilt = buildQuiz(BASE_QUESTIONS);
    setQuestions(rebuilt);
    setAnswers(Array(rebuilt.length).fill(-1));
    setSubmitted(false);
  }

  return (
    <div>
      <h2>Quiz (учебный тест)</h2>
      <p>При каждом открытии вкладки порядок вопросов и вариантов меняется.</p>

      <ol>
        {questions.map((q, qi) => (
          <li key={qi} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600 }}>{q.text}</div>
            {q.options.map((opt, oi) => {
              const picked = answers[qi] === oi;
              const correct = submitted && oi === q.correct;
              const wrong = submitted && picked && oi !== q.correct;
              const border =
                correct ? "2px solid #2e7d32" : wrong ? "2px solid #c62828" : "1px solid #bbb";
              return (
                <label
                  key={oi}
                  style={{
                    display: "block",
                    marginTop: 6,
                    padding: "6px 8px",
                    borderRadius: 8,
                    border
                  }}
                >
                  <input
                    type="radio"
                    name={`q${qi}`}
                    checked={picked}
                    onChange={() => choose(qi, oi)}
                    style={{ marginRight: 8 }}
                  />
                  {opt}
                </label>
              );
            })}
            {submitted && (
              <div style={{ marginTop: 6, fontSize: 13 }}>
                <b>Пояснение: </b>{q.explain}
              </div>
            )}
          </li>
        ))}
      </ol>

      {!submitted ? (
        <button onClick={submit} disabled={answers.includes(-1)}>
          Проверить
        </button>
      ) : (
        <>
          <p style={{ marginTop: 12 }}>
            Итог: <b>{score}</b> из <b>{questions.length}</b>
          </p>
          <button onClick={reset}>Сбросить</button>
        </>
      )}
    </div>
  );
}
