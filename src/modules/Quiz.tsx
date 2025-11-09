import { useMemo, useState } from "react";

const LOG_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzHlw1hQM3rUWwVrQynPp1J1XwWsrjAUPQJFQD8_QaXGCdoLdufy35kpOfqsWWxefJi/exec";
const LOG_VERSION = "v0.2.0";

function getClientId(): string {
  const k = "asapClientId";
  let id = localStorage.getItem(k);
  if (!id) {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      id = crypto.randomUUID();
    } else {
      id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    localStorage.setItem(k, id);
  }
  return id;
}

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
  const options = shuffledIdx.map((i) => q.options[i]);
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
    explain:
      "SPF публикуется в TXT-записях DNS для домена-отправителя (например, example.com: TXT «v=spf1 …»). Получатель использует эту политику для проверки, допускается ли IP-адрес отправляющего SMTP-хоста."
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
    explain:
      "Открытый ключ DKIM публикуется в TXT по имени вида selector._domainkey.example.com. В письме указывается селектор (s=) и домен (d=), по ним получатель извлекает ключ для верификации подписи."
  },
  {
    text: "Какой тег DMARC задаёт жёсткую политику отклонения?",
    options: ["rua=mailto:", "pct=100", "p=reject", "adkim=s"],
    correct: 2,
    explain:
      "Тег p управляет политикой домена: p=reject — требование отклонять сообщения, которые не проходят DMARC-выравнивание (ни SPF, ни DKIM не выровнены с доменом From)."
  },
  {
    text: "SPF=pass (НЕ выровнен), DKIM=fail. Итог DMARC?",
    options: ["pass", "fail", "temporary pass", "neutral"],
    correct: 1,
    explain:
      "DMARC требует, чтобы хотя бы один механизм (SPF или DKIM) был не просто успешным, но и выровненным с доменом From. Если DKIM=fail, а SPF pass относится к иному домену (не выровнен), итог DMARC — fail."
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
    explain:
      "MTA-STS-политика публикуется по HTTPS на mta-sts.<домен> в пути /.well-known/mta-sts.txt. Сам факт наличия политики анонсируется отдельной TXT-записью _mta-sts.<домен>, но файл политики берётся именно по HTTPS с поддоменом mta-sts."
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
    explain:
      "TLS-RPT (отчётность о доставке по TLS) публикуется как TXT-запись по имени _smtp._tls.<домен>. В ней задаётся mailto-адрес для агрегированных отчётов о TLS-сессиях."
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
    explain:
      "Чрезмерные scope’ы (Mail.ReadWrite + offline_access) у стороннего приложения без понятного бизнес-кейса — высокий риск: возможна долговременная эксфильтрация/манипуляции письмами."
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
    explain:
      "Двухканальная верификация (звонок/личное подтверждение по известному номеру, не из письма) — ключевая организационная мера для предотвращения подмены реквизитов."
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
    explain:
      "Заголовок X-MS-Exchange-Transport-Rules добавляется при обработке письма транспортными правилами Exchange и помогает в триаже/аудите."
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
    explain:
      "adkim=s включает строгое выравнивание DKIM: домен из тега d= в подписи должен точно совпадать с доменом в поле From (без использования организационного домена)."
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
    explain:
      "Правила с action=forward на внешний адрес — частый индикатор компрометации и эксфильтрации. Их следует инвентаризировать и при необходимости блокировать."
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
    explain:
      "Тег pct управляет долей сообщений, к которым применяется политика (семплирование). pct=25 — применяем политику к 25% входящих для домена From."
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
    explain:
      "DMARC публикуется как TXT по имени _dmarc.<домен>, например _dmarc.example.com: «v=DMARC1; p=…; rua=…». Не путать с DKIM (_domainkey) и ARC."
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
    explain:
      "LOTS — злоупотребление доверенными внешними сервисами (облака, SaaS, публичные площадки). Эксплуатация локальной уязвимости MTA — это не LOTS, а прямой техэксплойт инфраструктуры."
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
    explain:
      "Несвойственный компании формат счёта/шаблона письма, неожиданные поля/сроки оплаты — частый маркер BEC. Требуется двухканальная верификация до проведения платежа."
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
    if (submitted) return; // блокируем смену после «Проверить»
    const next = answers.slice();
    next[qi] = oi;
    setAnswers(next);
  }

  function submit() {
    setSubmitted(true);

    // Логирование результата в Google Apps Script → Sheets
    const payload = {
      ts: new Date().toISOString(),
      score,
      total: questions.length,
      version: LOG_VERSION,
      clientId: getClientId(),
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      page: location.href,
      tzOffset: new Date().getTimezoneOffset()
    };

    try {
      fetch(LOG_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  function reset() {
    const rebuilt = buildQuiz(BASE_QUESTIONS);
    setQuestions(rebuilt);
    setAnswers(Array(rebuilt.length).fill(-1));
    setSubmitted(false);
  }

  return (
    <div className="quiz-wrap">
      <h2>Quiz (учебный тест)</h2>
      <p><b>Внимание!</b> При каждом открытии вкладки порядок вопросов и вариантов меняется.</p>

      <ol>
        {questions.map((q, qi) => {
          const picked = answers[qi];
          const isWrong = submitted && picked !== q.correct; // показываем пояснение ТОЛЬКО при ошибке
          return (
            <li key={qi} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600 }}>{q.text}</div>
              {q.options.map((opt, oi) => {
                const selected = picked === oi;
                const correct = submitted && oi === q.correct;
                const wrong = submitted && selected && oi !== q.correct;
                const border = correct
                  ? "2px solid #2e7d32"
                  : wrong
                  ? "2px solid #c62828"
                  : "1px solid #bbb";
                return (
                  <label
                    key={oi}
                    style={{
                      display: "block",
                      marginTop: 6,
                      padding: "6px 8px",
                      borderRadius: 8,
                      border,
                      opacity: submitted ? 0.9 : 1,
                      cursor: submitted ? "default" : "pointer"
                    }}
                  >
                    <input
                      type="radio"
                      name={`q${qi}`}
                      checked={selected}
                      onChange={() => choose(qi, oi)}
                      disabled={submitted}
                      style={{ marginRight: 8 }}
                    />
                    {opt}
                  </label>
                );
              })}

              {isWrong && (
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  <b>Пояснение: </b>
                  {q.explain}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!submitted ? (
        <button className="btn primary" onClick={submit} disabled={answers.includes(-1)}>
          Проверить
        </button>
      ) : (
        <>
          <p style={{ marginTop: 12 }}>
            Итог: <b>{score}</b> из <b>{questions.length}</b>
          </p>
          <button className="btn ghost" onClick={reset}>
            Сбросить
          </button>
        </>
      )}
    </div>
  );
}
