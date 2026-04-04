import { loadConfig } from "./config.js";
import { Supervisor } from "./supervisor.js";

const config = loadConfig();
const supervisor = new Supervisor(config);
supervisor.start();
