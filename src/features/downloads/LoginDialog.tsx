import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { Tooltip } from '../../components/Tooltip';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { displayName } from '../../downloads/list';
import { api } from '../../lib/api';
import { ERROR_MESSAGES, toApiError } from '../../lib/errors';
import { useDownloadsStore } from '../../stores/downloads';
import { useUiStore, type LoginRequest } from '../../stores/ui';
import { parseHeaders } from '../add/addLogic';

/**
 * Asks for the login, custom headers or SSH key a download had, which Apollo Download Manager never keeps after it closes (PO
 * decisions on #58 and #59), then resumes or retries it. What is typed stays in memory; the core checks it as the
 * Add dialog's.
 */
export function LoginDialog() {
  const request = useUiStore((s) => s.loginRequest);
  const close = useUiStore((s) => s.closeLogin);
  return request ? <LoginForm key={request.id} request={request} onClose={close} /> : null;
}

function LoginForm({ request, onClose }: { request: LoginRequest; onClose: () => void }) {
  const download = useDownloadsStore((s) => s.snapshot?.downloads.find((d) => d.id === request.id));
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [headersText, setHeadersText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [remember, setRemember] = useState(false);
  const sftp = download?.kind === 'sftp';
  // The server refused the login it had (#249), rather than a restart losing it (#59).
  const refused = download?.status === 'failed' && download.error?.loginRequired === true;
  const name = download ? displayName(download) : 'this download';
  const headers = parseHeaders(headersText);
  const verb = request.then === 'resume' ? 'Resume' : 'Retry';

  async function pickKey() {
    try {
      const picked = await api.chooseSshKey();
      if (picked) setKeyPath(picked);
    } catch (e) {
      setError(toApiError(e).message);
    }
  }

  async function submit() {
    if (headers.error) return;
    setSending(true);
    setError(null);
    try {
      await api.setDownloadLogin(request.id, {
        credentials: userName || password ? { userName, password } : null,
        sshKey: sftp && keyPath.trim() ? { path: keyPath.trim(), passphrase: passphrase || null } : null,
        headers: headers.headers,
      });
      // Into the system's keychain, as the Add dialog does (#70); a refusal is said, and the retry goes on.
      if (remember) await api.rememberLogin(request.id).catch((e: unknown) => { toast.error(`The login wasn’t remembered: ${toApiError(e).message}`); });
      const result = request.then === 'resume' ? await api.resumeDownloads([request.id]) : await api.retryDownloads([request.id]);
      const failed = result.failed[0];
      if (failed) toast.error(ERROR_MESSAGES[failed.code]);
      onClose();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={refused ? 'Log in to download' : 'Enter the login again'}
      description={
        refused
          ? `The server asks for a login to download “${name}”.`
          : `Apollo Download Manager doesn’t keep logins, custom headers or SSH keys after it closes, unless you ask it to remember them. Enter what “${name}” needs to continue.`
      }
      footer={
        <>
          <Button onClick={onClose}>Not now</Button>
          <Button variant="primary" busy={sending} disabled={headers.error !== null} onClick={() => void submit()}>
            {refused ? 'Log in and retry' : verb}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {refused ? (
          <p role="status" className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
            The server refused the login. Check the user name and password, then try again.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="User name">{(p) => <Input {...p} value={userName} onChange={(e) => { setUserName(e.target.value); }} autoComplete="off" autoFocus />}</Field>
          <Field label="Password" hint="Kept in memory only, unless remembered below.">
            {(p) => <Input {...p} type="password" value={password} onChange={(e) => { setPassword(e.target.value); }} autoComplete="off" />}
          </Field>
        </div>
        {sftp ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="SSH private key" hint="With the user name above.">
              {(p) => (
                <div className="flex gap-2">
                  <Input {...p} value={keyPath} onChange={(e) => { setKeyPath(e.target.value); }} placeholder="None: log in with the password" />
                  <Tooltip label="Choose a key">
                    <Button aria-label="Choose a key" onClick={() => void pickKey()}>
                      <KeyRound aria-hidden />
                    </Button>
                  </Tooltip>
                </div>
              )}
            </Field>
            <Field label="Key passphrase" hint="Only for a key that has one.">
              {(p) => <Input {...p} type="password" value={passphrase} onChange={(e) => { setPassphrase(e.target.value); }} autoComplete="off" />}
            </Field>
          </div>
        ) : (
          <Field label="Extra headers" error={headers.error} hint="One per line, like “Cookie: session=…”. Kept in memory only, unless remembered below.">
            {(p) => <Textarea {...p} value={headersText} onChange={(e) => { setHeadersText(e.target.value); }} rows={2} placeholder="Name: value" />}
          </Field>
        )}
        <Checkbox checked={remember} onChange={setRemember}>
          Remember this login, in the system’s password store
        </Checkbox>
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
