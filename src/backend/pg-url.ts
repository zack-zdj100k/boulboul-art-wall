// node-postgres already verifies the server certificate for sslmode=prefer/require/verify-ca, and
// prints a "SECURITY WARNING" asking to spell it out. Same behaviour, explicit, no warning.
// (No "server-only" import: the scripts in /scripts use it too.)
export function pgConnectionString(url: string) {
  return url.replace(/([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/, "$1verify-full");
}
