'use client';

import { useCallback, useEffect, useState } from 'react';

interface RepoStatus {
  name: string;
  type: string;
  url: string;
  ci: 'success' | 'failure' | 'in_progress' | 'unknown';
  ciUrl?: string;
  lastRunAt?: string;
  openPRs: number;
}
interface SpecInfo {
  id: string;
  title: string;
  area: string;
  path: string;
  sensitive: boolean;
}
interface Run {
  id: number;
  name: string;
  number: number;
  status: string;
  conclusion: string | null;
  url: string;
  at: string;
  event: string;
}

const CI_LABEL: Record<string, string> = {
  success: 'verde',
  failure: 'falhou',
  in_progress: 'rodando',
  unknown: '—',
};

function ago(iso?: string): string {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s atrás`;
  if (s < 3600) return `${Math.floor(s / 60)}min atrás`;
  if (s < 86400) return `${Math.floor(s / 3600)}h atrás`;
  return `${Math.floor(s / 86400)}d atrás`;
}

function runState(r: Run): string {
  return r.status === 'completed' ? r.conclusion ?? 'unknown' : r.status === 'in_progress' ? 'in_progress' : 'queued';
}

export default function Page() {
  const [repos, setRepos] = useState<RepoStatus[]>([]);
  const [specs, setSpecs] = useState<SpecInfo[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem('dash_token') ?? '');
  }, []);

  const refresh = useCallback(async () => {
    const [s, sp, r] = await Promise.all([
      fetch('/api/status').then((x) => x.json()).catch(() => []),
      fetch('/api/specs').then((x) => x.json()).catch(() => []),
      fetch('/api/run').then((x) => x.json()).catch(() => []),
    ]);
    setRepos(s);
    setSpecs(sp);
    setRuns(r);
    setUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  function showToast(msg: string, kind: 'ok' | 'err') {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 6000);
  }

  async function run(spec: SpecInfo) {
    setBusy(spec.path);
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-dashboard-secret': token },
        body: JSON.stringify({ spec: spec.path }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? 'Falha ao acionar.', 'err');
      } else {
        showToast(`Pipeline acionado para "${spec.title}". Acompanhe abaixo.`, 'ok');
        setTimeout(refresh, 2500);
      }
    } catch (e) {
      showToast('Erro de rede ao acionar.', 'err');
    } finally {
      setBusy(null);
    }
  }

  const productRepos = repos.filter((r) => r.type !== 'infra');
  const infraRepos = repos.filter((r) => r.type === 'infra');

  return (
    <div className="wrap">
      <div className="top">
        <div className="brand">
          <span className="k">Plataforma de Engenharia · lifesystemsufpr</span>
          <h1>Painel de status &amp; ações</h1>
        </div>
        <div className="controls">
          <input
            type="password"
            placeholder="token de ação (opcional)"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              localStorage.setItem('dash_token', e.target.value);
            }}
          />
          <span className="dot" />
          <span className="muted">{updatedAt ? `atualizado ${ago(updatedAt.toISOString())}` : 'carregando…'}</span>
        </div>
      </div>

      <h2>Repositórios de produto</h2>
      <RepoGrid repos={productRepos} />

      <h2>Infra (plataforma)</h2>
      <RepoGrid repos={infraRepos} />

      <h2>Pipeline — acionar por spec</h2>
      {specs.length === 0 ? (
        <p className="empty">Sem specs carregados (ou sem acesso ao GitHub — defina GITHUB_TOKEN).</p>
      ) : (
        specs.map((s) => (
          <div className="spec" key={s.path}>
            <div className="info">
              <div className="t">
                {s.title}{' '}
                <span className={`badge ${s.sensitive ? 'sensitive' : 'general'}`}>
                  {s.sensitive ? `⛔ ${s.area}` : s.area}
                </span>
              </div>
              <div className="p">
                {s.path}
                {s.sensitive && ' · guard-rail: exige revisão humana'}
              </div>
            </div>
            <button
              className="run"
              disabled={s.sensitive || busy === s.path}
              onClick={() => run(s)}
              title={s.sensitive ? 'Bloqueado pelo guard-rail de saúde' : 'Disparar o pipeline'}
            >
              {busy === s.path ? 'Acionando…' : s.sensitive ? 'Bloqueado' : '▶ Rodar'}
            </button>
          </div>
        ))
      )}

      <h2>Atividade recente (devops-hub)</h2>
      <div className="feed">
        {runs.length === 0 ? (
          <p className="empty">Nenhum run recente.</p>
        ) : (
          runs.map((r) => {
            const st = runState(r);
            return (
              <div className="item" key={r.id}>
                <div className="l">
                  <span className={`pill ${st}`}>{CI_LABEL[st] ?? st}</span>
                  <span className="ti">
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.name} #{r.number}
                    </a>{' '}
                    <span className="at">· {r.event}</span>
                  </span>
                </div>
                <span className="at">{ago(r.at)}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="foot">
        Status read-only dos repos · acionar restrito ao pipeline demo (devops-hub) · geração de código
        ainda mockada (seam p/ Claude/Cursor SDK). Atualiza a cada 15s.
      </div>

      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}

function RepoGrid({ repos }: { repos: RepoStatus[] }) {
  if (repos.length === 0) return <p className="empty">Carregando…</p>;
  return (
    <div className="grid">
      {repos.map((r) => (
        <div className="card" key={r.name}>
          <div className="row">
            <span className="name">
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.name}
              </a>
            </span>
            <span className={`pill ${r.ci}`}>{CI_LABEL[r.ci] ?? r.ci}</span>
          </div>
          <div className="meta">
            <span className="type">{r.type}</span>
            <span>PRs abertos: {r.openPRs}</span>
            {r.ciUrl ? (
              <a href={r.ciUrl} target="_blank" rel="noreferrer">
                CI {ago(r.lastRunAt)}
              </a>
            ) : (
              <span>sem CI</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
