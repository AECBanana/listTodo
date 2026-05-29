import { Show, Switch, Match } from "solid-js";
import { store } from "./store";
import AuthPage from "./components/AuthPage";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import TaskList from "./components/TaskList";
import CalendarView from "./components/CalendarView";
import MatrixView from "./components/MatrixView";
import SettingsPanel from "./components/SettingsPanel";
import AISummary from "./components/AISummary";
import "./App.css";

export default function App() {
  return (
    <Show when={store.token()} fallback={<AuthPage />}>
      <div class="layout">
        <TitleBar />
        <div class="layout-main">
          <Sidebar />
          <Switch>
            <Match when={store.section() === "settings"}>
              <SettingsPanel />
            </Match>
            <Match when={store.section() === "calendar"}>
              <CalendarView />
            </Match>
            <Match when={store.section() === "matrix"}>
              <MatrixView />
            </Match>
            <Match when={store.section() === "ai"}>
              <AISummary />
            </Match>
            <Match when={true}>
              <TaskList />
            </Match>
          </Switch>
        </div>
      </div>
    </Show>
  );
}
