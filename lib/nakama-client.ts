import { Client, Session } from "@heroiclabs/nakama-js";

const client = new Client("defaultkey", "127.0.0.1", "7350");

let session: Session | null = null;

const setSession = (s: Session) => {
  session = s;
};

const getSession = () => {
  return session;
};

const clearSession = () => {
  session = null;
};

export default client;
export { setSession, getSession, clearSession };
