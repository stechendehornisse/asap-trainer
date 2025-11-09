import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import Quiz from "./modules/Quiz";
import HeaderCheck from "./modules/HeaderCheck";
import DmarcReader from "./modules/DmarcReader";
import RulesAudit from "./modules/RulesAudit";

const VERSION = "v0.2.1"; // версия в футере; в заголовке — без версии

function BackButton() {
  const nav = useNavigate();
  return (
    <button className="back" onClick={() => nav(-1)} title="Назад" aria-label="Назад">
      Назад
    </button>
  );
}

function TopBar() {
  const loc = useLocation();
  // Для HashRouter pathname будет "/", "/quiz", "/headers", ...
  const onHome = loc.pathname === "/";

  return (
    <div className="topbar">
      <div className="container" style={{ display: "flex", gap: 12, alignItems: "center", minHeight: 56 }}>
        {/* Логотип = «домой» (только картинка) */}
        <Link to="/" className="brand" aria-label="На главную">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="ASAP — anti-BEC trainer" />
        </Link>
        <span className="divider" aria-hidden="true">|</span>

        {/* Равные кнопки модулей */}
        <nav className="nav" aria-label="Основная навигация">
          <Link to="/quiz">Quiz</Link>
          <Link to="/headers">Header Check</Link>
          <Link to="/dmarc">DMARC RUA Reader</Link>
          <Link to="/rules">Rules Audit</Link>
        </nav>

        {/* «Назад» только НЕ на главной */}
        <div className="back-wrap">
          {!onHome && <BackButton />}
        </div>
      </div>
    </div>
  );
}

/* Главная: большой заголовок без версии + подзаголовок ниже (менее заметный) + 1+3 карточки */
function Home() {
  return (
    <div className="page">
      <div className="hero-title">ASAP — Anti-BEC Skill Assessment Platform</div>
      <p className="hero-sub">
        Учебный тренажёр для технического персонала: противодействие BEC (почтовая инфраструктура и организационные меры).
      </p>

      <div className="cards">
        <Card to="/quiz"   t="Quiz (15 вопросов)"
              d="Быстрый контроль теории: SPF/DKIM/DMARC, MTA-STS/TLS-RPT, правила ящика, организационные меры." />
        <Card to="/headers" t="Header Check"
              d="Загрузите заголовки письма (txt) — подсказки по подозрительным признакам и транспорту." />
        <Card to="/dmarc"  t="DMARC RUA Reader"
              d="Парсер отчётов RUA (XML): домены, выравнивание, доля fail." />
        <Card to="/rules"  t="Rules Audit"
              d="Проверка экспортированных правил ящика: внешние переадресации, ловушки и риски." />
      </div>
    </div>
  );
}

/* Оболочка маршрутов */
function Shell() {
  return (
    <>
      <TopBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/quiz"    element={<div className="page"><Quiz /></div>} />
        <Route path="/headers" element={<div className="page"><HeaderCheck /></div>} />
        <Route path="/dmarc"   element={<div className="page"><DmarcReader /></div>} />
        <Route path="/rules"   element={<div className="page"><RulesAudit /></div>} />
      </Routes>
      <footer className="footer">
        © 2025 ASAP (учебный прототип). Версия {VERSION}. Все данные — учебные.
      </footer>
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}

function Card(props: { to: string; t: string; d: string }) {
  return (
    <Link to={props.to} className="card">
      <div className="t">{props.t}</div>
      <div className="d">{props.d}</div>
    </Link>
  );
}
