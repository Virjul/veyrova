import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, Boxes, Check, CircleHelp, Code2,
  ExternalLink, FolderGit2, LoaderCircle, LogOut, Pencil, Plus, Save, Settings2,
  ShieldCheck, Trash2, X, FileCode2, FilePlus2, FolderPlus, FileText, Upload, Download, RefreshCw, ListTodo, HardDrive,
} from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
type Project = { id: string; user_id: string; name: string; description: string | null; created_at: string };
const projectColumns = 'id, user_id, name, description, created_at';

function projectErrorMessage(message: string, action: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('row-level security') || normalized.includes('permission denied') || normalized.includes('not allowed')) {
    return `Supabase blocked this request to ${action}. Check that the existing public.projects RLS policies allow signed-in users to access only rows where user_id = auth.uid().`;
  }
  if (normalized.includes('does not exist') || normalized.includes('schema cache')) {
    return `The public.projects table does not match Veyrova’s expected columns (id, user_id, name, description, created_at). Supabase says: ${message}`;
  }
  if (normalized.includes('fetch') || normalized.includes('network')) {
    return `Could not reach Supabase while trying to ${action}. Check your connection and try again.`;
  }
  return message;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className={`brand ${compact ? 'brand-compact' : ''}`} aria-label="Veyrova home" data-testid="link-brand">
    <span className="brand-mark"><span /><span /><span /></span><span>veyrova</span>
  </Link>;
}

function Header({ user, signOut }: { user: User | null; signOut: () => void }) {
  return <header className="topbar">
    <div className="topbar-inner">
      <Brand />
      <nav className="top-nav" aria-label="Main navigation">
        <Link href="/" className="nav-link" data-testid="link-projects"><FolderGit2 size={15} /> Projects</Link>
        <Link href="/github" className="nav-link"><FolderGit2 size={15} /> GitHub Explorer</Link>
        <Link href="/data" className="nav-link"><Boxes size={15} /> Data Explorer</Link>
        <Link href="/setup" className="nav-link" data-testid="link-setup"><Settings2 size={15} /> Setup guide</Link>
      </nav>
      <div className="top-actions">
        <span className="status-pill"><span className="status-dot" /> Workspace</span>
        {user ? <div className="account-chip" title={user.email ?? 'Signed in'}>
          <span className="avatar">{(user.email?.[0] ?? 'U').toUpperCase()}</span>
          <span className="account-email">{user.email}</span>
          <button className="icon-button signout" aria-label="Sign out" onClick={signOut} data-testid="button-sign-out"><LogOut size={16} /></button>
        </div> : <Link href="/auth" className="button button-quiet" data-testid="link-sign-in">Sign in <ArrowRight size={15} /></Link>}
      </div>
    </div>
  </header>;
}

function PageFrame({ children, user, signOut }: { children: ReactNode; user: User | null; signOut: () => void }) {
  return <div className="app-shell"><Header user={user} signOut={signOut} /><main className="main-content">{children}</main>
    <footer className="site-footer"><Brand compact /><span>A quieter place to build.</span><Link href="/setup" data-testid="footer-setup">Documentation <ExternalLink size={13} /></Link></footer>
  </div>;
}

function MessageBox({ tone = 'error', children }: { tone?: 'error' | 'info' | 'success'; children: ReactNode }) {
  return <div className={`message-box message-${tone}`} role={tone === 'error' ? 'alert' : 'status'} data-testid={`status-${tone}`}>{children}</div>;
}

function SetupCallout({ compact = false }: { compact?: boolean }) {
  return <div className={`setup-callout ${compact ? 'setup-callout-compact' : ''}`}>
    <div className="callout-icon"><ShieldCheck size={18} /></div>
    <div><strong>{supabaseConfigured ? 'Project storage needs attention' : 'Connect your Supabase project'}</strong>
      <p>{supabaseConfigured ? 'Check the projects table and row-level security policies in the setup guide.' : 'Add the public project URL and publishable key to enable sign-in and project storage.'}</p>
    </div>
    <Link className="callout-link" href="/setup" data-testid="link-configure">{compact ? 'Setup guide' : 'Open setup guide'} <ArrowRight size={15} /></Link>
  </div>;
}

function prettyDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

function Home({ user, authError }: { user: User | null; authError: string | null }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(Boolean(user && supabase));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [successUserId, setSuccessUserId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setProjects([]);
    setError('');
    setSuccess('');
    setSuccessUserId(null);
    setShowCreate(false);
  }, [user?.id]);

  useEffect(() => {
    let alive = true;
    setProjects([]);
    setError('');
    if (!user || !supabase) {
      setLoading(false);
      return () => { alive = false; };
    }
    setLoading(true);
    void (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('projects')
          .select(projectColumns)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (!alive) return;
        if (queryError) setError(projectErrorMessage(queryError.message, 'load projects'));
        else setProjects((data ?? []) as Project[]);
      } catch (err) {
        if (!alive) return;
        setError(projectErrorMessage(err instanceof Error ? err.message : 'Unable to load projects.', 'load projects'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id, refresh]);

  const visibleProjects = user ? projects.filter((project) => project.user_id === user.id) : [];

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !supabase) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    if (!name) { setError('Enter a project name.'); return; }
    if (name.length > 120) { setError('Project names must be 120 characters or fewer.'); return; }
    if (description.length > 1000) { setError('Descriptions must be 1,000 characters or fewer.'); return; }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { error: insertError } = await supabase.from('projects').insert({
        user_id: user.id,
        name,
        description: description || null,
      });
      if (insertError) {
        setError(projectErrorMessage(insertError.message, 'create a project'));
        return;
      }
      setShowCreate(false);
      setSuccess('Project created.');
      setSuccessUserId(user.id);
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(projectErrorMessage(err instanceof Error ? err.message : 'Unable to create this project.', 'create a project'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(project: Project) {
    if (!user || !supabase || !window.confirm(`Delete “${project.name}”? This cannot be undone.`)) return;
    setDeleting(project.id);
    setError('');
    setSuccess('');
    try {
      const { data, error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id)
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle();
      if (deleteError) {
        setError(projectErrorMessage(deleteError.message, 'delete this project'));
        return;
      }
      if (!data) {
        setError('This project was not deleted. It may no longer exist or you may not have permission to remove it.');
        return;
      }
      setProjects((items) => items.filter((item) => item.id !== project.id));
      setSuccess(`“${project.name}” was deleted.`);
      setSuccessUserId(user.id);
    } catch (err) {
      setError(projectErrorMessage(err instanceof Error ? err.message : 'Unable to delete this project.', 'delete this project'));
    } finally {
      setDeleting(null);
    }
  }

  return <PageFrame user={user} signOut={() => supabase?.auth.signOut()}>
    <div className="page-eyebrow"><span className="eyebrow-line" /> YOUR WORKSPACE <span className="eyebrow-slash">/</span> PROJECTS</div>
    <section className="welcome-row">
      <div><h1>Make room for<br /><span>what you're building.</span></h1>
        <p className="welcome-copy">A focused home for your projects. Keep your work close, and your noise somewhere else.</p></div>
      {user && <button onClick={() => { setError(''); setSuccess(''); setSuccessUserId(null); setShowCreate(true); }} className="button button-primary" data-testid="button-new-project"><Plus size={17} /> Create Project</button>}
    </section>

    {!supabaseConfigured && <SetupCallout />}
    {supabaseConfigured && !supabase && <SetupCallout />}

    {!user && authError && <div className="auth-callback-error"><MessageBox>{authError}</MessageBox></div>}
    {!user && <section className="signed-out-panel">
      <div className="signed-out-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><Code2 size={24} /></div><span className="orbit-node node-a" /><span className="orbit-node node-b" /><span className="orbit-node node-c" /></div>
      <div className="signed-out-content"><span className="micro-label">A workspace that's yours</span><h2>Start with a clear slate.</h2><p>Sign in to see your projects, or create an account to make this space your own.</p>
        <div className="signed-out-actions"><Link href="/auth" className="button button-primary" data-testid="button-get-started">Sign in or create account <ArrowRight size={16} /></Link><Link href="/setup" className="text-link" data-testid="link-setup-start">Set up Supabase <ArrowDownLeft size={14} /></Link></div>
      </div>
    </section>}

    {user && <section className="projects-area">
      <div className="section-heading"><div><span className="micro-label">YOUR COLLECTION</span><h2>Projects <span className="count-badge">{visibleProjects.length}</span></h2></div>
        <div className="project-meta">{loading ? 'Syncing workspace' : `${visibleProjects.length} ${visibleProjects.length === 1 ? 'project' : 'projects'}`} <span className={`sync-indicator ${loading ? 'is-syncing' : ''}`} /></div>
      </div>
      {success && successUserId === user.id && <div className="project-feedback"><MessageBox tone="success">{success}</MessageBox></div>}
      {error && !showCreate && <div className="query-error"><MessageBox>{error}<Link href="/setup" className="error-action" data-testid="link-error-setup">Check project setup <ArrowRight size={14} /></Link></MessageBox><button className="icon-button dismiss-error" onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
      {!supabase && <SetupCallout compact />}
      {loading && <div className="project-list" aria-label="Loading projects">{[0, 1, 2].map((item) => <div className="skeleton-row" key={item}><span className="skeleton-icon" /><span className="skeleton-lines"><i /><i /></span><span className="skeleton-date" /></div>)}</div>}
      {!loading && supabase && !error && visibleProjects.length === 0 && <div className="empty-state">
        <div className="empty-mark"><Boxes size={27} /></div><span className="micro-label">NOTHING HERE YET</span><h3>Your next thing starts here.</h3><p>Create a project to give your work a home. Only you can see what's in your workspace.</p>
        <button className="button button-primary" onClick={() => { setError(''); setSuccess(''); setSuccessUserId(null); setShowCreate(true); }} data-testid="button-create-first"><Plus size={16} /> Create your first project</button>
      </div>}
      {!loading && visibleProjects.length > 0 && <div className="project-list">
        {visibleProjects.map((project, index) => <article className="project-row" key={project.id} data-testid={`project-row-${project.id}`}>
          <div className={`project-glyph glyph-${index % 4}`}><FolderGit2 size={18} /></div>
          <Link href={`/projects/${encodeURIComponent(project.id)}`} className="project-info project-info-link" data-testid={`link-open-project-${project.id}`}>
            <h3>{project.name}</h3><p>{project.description || 'No description added'}</p>
          </Link>
          <div className="project-date"><span>CREATED</span>{prettyDate(project.created_at)}</div>
          <div className="project-actions"><span className="private-label"><ShieldCheck size={13} /> Private</span><Link href={`/projects/${encodeURIComponent(project.id)}`} className="open-project-link" aria-label={`Open ${project.name}`} data-testid={`button-open-project-${project.id}`}>Open <ArrowRight size={14} /></Link><button onClick={() => deleteProject(project)} className="icon-button delete-project" aria-label={`Delete ${project.name}`} disabled={deleting === project.id} data-testid={`button-delete-${project.id}`}>{deleting === project.id ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}</button></div>
        </article>)}
      </div>}
    </section>}

    {user && showCreate && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
      <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <div className="modal-heading"><div><span className="micro-label">NEW WORKSPACE ITEM</span><h2 id="create-title">Create a project</h2></div><button className="icon-button" aria-label="Close dialog" onClick={() => setShowCreate(false)} data-testid="button-close-create"><X size={18} /></button></div>
        <p className="modal-copy">Give this project a name you’ll recognize.</p>
        <form onSubmit={createProject} className="project-form">
          <label htmlFor="project-name">Project name</label><input autoFocus id="project-name" name="name" maxLength={120} required placeholder="e.g. Fieldnotes" data-testid="input-project-name" />
          <label htmlFor="project-description">Description <span>Optional</span></label><textarea id="project-description" name="description" maxLength={1000} rows={3} placeholder="A short note about what you're making" data-testid="input-project-description" />
          {error && <MessageBox>{error}</MessageBox>}
          <div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)} className="button button-quiet">Cancel</button><button type="submit" className="button button-primary" disabled={saving} data-testid="button-save-project">{saving ? <><LoaderCircle className="spin" size={16} /> Saving</> : <><Plus size={16} /> Create project</>}</button></div>
        </form>
      </section>
    </div>}
  </PageFrame>;
}

function ProjectRoute({ user }: { user: User | null }) {
  const params = useParams<{ projectId: string }>();
  return <ProjectPage user={user} projectId={params.projectId ?? ''} />;
}

function ProjectPage({ user, projectId }: { user: User | null; projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [successUserId, setSuccessUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setProject(null);
    setError('');
    setSuccess('');
    setSuccessUserId(null);
    setEditing(false);
    setEditName('');
    setEditDescription('');
    setLoading(true);
    if (!user || !supabase || !projectId) {
      setLoading(false);
      return () => { active = false; };
    }
    void (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('projects')
          .select(projectColumns)
          .eq('id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!active) return;
        if (queryError) setError(projectErrorMessage(queryError.message, 'open this project'));
        else if (!data) setError('Project not found, or you do not have permission to view it.');
        else setProject(data as Project);
      } catch (err) {
        if (active) setError(projectErrorMessage(err instanceof Error ? err.message : 'Unable to open this project.', 'open this project'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [projectId, user?.id]);

  const visibleProject = user && project?.user_id === user.id ? project : null;
  const visibleSuccess = user && successUserId === user.id ? success : '';

  function startEditing() {
    if (!user || !project || project.user_id !== user.id) return;
    setEditName(project.name);
    setEditDescription(project.description ?? '');
    setError('');
    setSuccess('');
    setSuccessUserId(null);
    setEditing(true);
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !supabase || !project || project.user_id !== user.id) return;
    const name = editName.trim();
    const description = editDescription.trim();
    if (!name) { setError('Enter a project name.'); return; }
    if (name.length > 120) { setError('Project names must be 120 characters or fewer.'); return; }
    if (description.length > 1000) { setError('Descriptions must be 1,000 characters or fewer.'); return; }
    setSaving(true);
    setError('');
    setSuccess('');
    setSuccessUserId(null);
    try {
      const { data, error: updateError } = await supabase
        .from('projects')
        .update({ name, description: description || null })
        .eq('id', project.id)
        .eq('user_id', user.id)
        .select(projectColumns)
        .maybeSingle();
      if (updateError) {
        setError(projectErrorMessage(updateError.message, 'edit this project'));
        return;
      }
      if (!data) {
        setError('This project was not updated. It may no longer exist or you may not have permission to edit it.');
        return;
      }
      setProject(data as Project);
      setEditing(false);
      setSuccess('Project updated.');
      setSuccessUserId(user.id);
    } catch (err) {
      setError(projectErrorMessage(err instanceof Error ? err.message : 'Unable to update this project.', 'edit this project'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject() {
    if (!user || !supabase || !project || project.user_id !== user.id || !window.confirm(`Delete “${project.name}”? This cannot be undone.`)) return;
    setDeleting(true);
    setError('');
    setSuccess('');
    setSuccessUserId(null);
    try {
      const { data, error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id)
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle();
      if (deleteError) {
        setError(projectErrorMessage(deleteError.message, 'delete this project'));
        return;
      }
      if (!data) {
        setError('This project was not deleted. It may no longer exist or you may not have permission to remove it.');
        return;
      }
      setProject(null);
      setSuccess('Project deleted.');
      setSuccessUserId(user.id);
    } catch (err) {
      setError(projectErrorMessage(err instanceof Error ? err.message : 'Unable to delete this project.', 'delete this project'));
    } finally {
      setDeleting(false);
    }
  }

  return <PageFrame user={user} signOut={() => supabase?.auth.signOut()}>
    <div className="page-eyebrow"><span className="eyebrow-line" /> YOUR WORKSPACE <span className="eyebrow-slash">/</span> PROJECT</div>
    <div className="project-detail-back"><Link href="/" className="text-link" data-testid="link-back-projects"><ArrowLeft size={15} /> Back to projects</Link></div>
    {!user && <section className="project-message-panel"><h1>Sign in to open projects</h1><p>Projects are private to the account that created them.</p><Link href="/auth" className="button button-primary">Sign in <ArrowRight size={15} /></Link></section>}
    {user && !supabase && <SetupCallout />}
    {user && loading && <div className="project-detail-loading" role="status"><LoaderCircle className="spin" size={19} /> Loading project</div>}
    {user && !loading && error && !visibleProject && <section className="project-message-panel"><MessageBox>{error}</MessageBox><Link href="/" className="button button-quiet" data-testid="button-project-not-found-back">Back to projects</Link></section>}
    {user && !loading && !visibleProject && !error && visibleSuccess && <section className="project-message-panel"><MessageBox tone="success">{visibleSuccess}</MessageBox><Link href="/" className="button button-primary" data-testid="button-project-deleted-back">Back to projects <ArrowRight size={15} /></Link></section>}
    {user && !loading && visibleProject && <section className="project-detail">
      <div className="project-detail-heading">
        <div className="project-detail-glyph"><FolderGit2 size={21} /></div>
        <div className="project-detail-title"><span className="micro-label">PRIVATE PROJECT</span><h1>{visibleProject.name}</h1><p>Created {prettyDate(visibleProject.created_at)}</p></div>
        {!editing && <div className="project-detail-actions"><Link href={`/projects/${visibleProject.id}/repository`} className="button button-primary" data-testid="button-open-repository"><FileCode2 size={15} /> Open repository</Link><Link href={`/projects/${visibleProject.id}/issues`} className="button button-quiet"><ListTodo size={15} /> Issues</Link><Link href={`/projects/${visibleProject.id}/assets`} className="button button-quiet"><HardDrive size={15} /> Assets</Link><button className="button button-quiet" onClick={startEditing} data-testid="button-edit-project"><Pencil size={15} /> Edit project</button><button className="button button-danger" onClick={deleteProject} disabled={deleting} data-testid="button-delete-project">{deleting ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />} Delete</button></div>}
      </div>
      {visibleSuccess && <div className="project-feedback"><MessageBox tone="success">{visibleSuccess}</MessageBox></div>}
      {error && <div className="project-feedback"><MessageBox>{error}</MessageBox></div>}
      {editing
        ? <form onSubmit={saveProject} className="project-detail-card project-form detail-edit-form">
          <div className="detail-card-heading"><span className="micro-label">PROJECT DETAILS</span><p>Update the name and description saved to your workspace.</p></div>
          <label htmlFor="edit-project-name">Project name</label>
          <input id="edit-project-name" value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={120} required data-testid="input-edit-project-name" />
          <label htmlFor="edit-project-description">Description <span>Optional</span></label>
          <textarea id="edit-project-description" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={1000} rows={5} data-testid="input-edit-project-description" />
          <div className="modal-actions"><button type="button" onClick={() => { setEditing(false); setError(''); }} className="button button-quiet" disabled={saving}>Cancel</button><button type="submit" className="button button-primary" disabled={saving} data-testid="button-save-project-edit">{saving ? <><LoaderCircle className="spin" size={15} /> Saving</> : <><Save size={15} /> Save changes</>}</button></div>
        </form>
        : <article className="project-detail-card">
          <div className="detail-card-heading"><span className="micro-label">ABOUT THIS PROJECT</span></div>
          <p className={`project-description-full ${visibleProject.description ? '' : 'is-empty'}`}>{visibleProject.description || 'No description has been added yet.'}</p>
        </article>}
    </section>}
  </PageFrame>;
}


type Issue = { id: string; project_id: string; user_id: string; title: string; body: string; status: string; created_at: string };

function IssuesPage({ user }: { user: User | null }) {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId ?? '';
  const [issues, setIssues] = useState<Issue[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  async function reload() {
    if (!supabase || !user) return;
    const result = await supabase.from('veyrova_issues').select('id,project_id,user_id,title,body,status,created_at').eq('project_id', projectId).order('created_at', { ascending: false });
    if (result.error) setError(result.error.message);
    else { setIssues((result.data ?? []) as Issue[]); setError(''); }
  }
  useEffect(() => { let active = true; if (!user || !supabase) { setLoading(false); return; }
    void supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).maybeSingle().then(async ({data,error}) => {
      if (!active) return;
      if (error || !data) { setError('Project not found or access denied.'); setLoading(false); return; }
      await reload(); if (active) setLoading(false);
    }); return () => { active = false; };
  }, [projectId, user?.id]);
  async function createIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !user || !title.trim() || busy) return;
    setBusy(true);
    const result = await supabase.from('veyrova_issues').insert({ project_id: projectId, user_id: user.id, title: title.trim().slice(0,160), body: body.slice(0,10000), status: 'open' });
    if (result.error) setError(result.error.message); else { setTitle(''); setBody(''); await reload(); }
    setBusy(false);
  }
  async function setStatus(issue: Issue) {
    if (!supabase || busy) return; setBusy(true);
    const result = await supabase.from('veyrova_issues').update({status: issue.status === 'open' ? 'closed' : 'open'}).eq('id',issue.id).eq('project_id',projectId);
    if (result.error) setError(result.error.message); else await reload(); setBusy(false);
  }
  return <PageFrame user={user} signOut={() => { void supabase?.auth.signOut(); }}>
    <div className="page-container"><Link href={`/projects/${projectId}`} className="nav-link"><ArrowLeft size={16}/> Back to project</Link>
      <h1><ListTodo size={24}/> Issues</h1><p>Track project bugs and tasks. Stored securely in Supabase.</p>
      {error && <p role="alert" className="form-error">{error} — Run the Veyrova SQL migration if the table is missing.</p>}
      {user && <form onSubmit={createIssue} className="panel" style={{padding:20,display:'grid',gap:12}}>
        <label>Issue title<input className="form-input" value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} required /></label>
        <label>Description<textarea className="form-input" value={body} maxLength={10000} rows={3} onChange={e=>setBody(e.target.value)}/></label>
        <button className="button button-primary" disabled={busy || !title.trim()} type="submit">Create issue</button>
      </form>}
      {loading ? <p>Loading issues…</p> : <div style={{display:'grid',gap:12,marginTop:20}}>{issues.map(issue=><section key={issue.id} className="panel" style={{padding:16}}>
        <strong>{issue.title}</strong> <span>({issue.status})</span><p style={{whiteSpace:'pre-wrap'}}>{issue.body}</p>
        <button className="button button-quiet" disabled={busy} onClick={()=>void setStatus(issue)}>{issue.status === 'open' ? 'Close issue' : 'Reopen issue'}</button>
      </section>)}{issues.length === 0 && <p>No issues yet.</p>}</div>}
    </div>
  </PageFrame>;
}

function AssetsPage({ user }: { user: User | null }) {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId ?? '';
  const [paths, setPaths] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bucket = 'veyrova-assets';
  const prefix = user ? `${user.id}/${projectId}/` : '';
  async function refresh() {
    if (!supabase || !user) return;
    const { data, error: listError } = await supabase.storage.from(bucket).list(prefix, {limit:100});
    if (listError) setError(listError.message); else {setPaths((data ?? []).filter(f=>f.name !== '.emptyFolderPlaceholder').map(f=>f.name));setError('');}
  }
  useEffect(()=>{ if (!user || !supabase) return; let active = true;
    void supabase.from('projects').select('id').eq('id',projectId).eq('user_id',user.id).maybeSingle().then(({data})=>{if(active && data) void refresh();else if(active) setError('Project not found or access denied.');});
    return ()=>{active=false;};
  },[projectId,user?.id]);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files=Array.from(event.target.files ?? []); if (!supabase || !user || !files.length) return;
    setBusy(true);setError('');
    for(const file of files) {
      if(file.size > 10*1024*1024){setError(`${file.name}: max 10 MB per file`);break;}
      const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const {error: uploadError}=await supabase.storage.from(bucket).upload(prefix + crypto.randomUUID() + '-' + safeName,file,{upsert:false});
      if(uploadError){setError(uploadError.message);break;}
    }
    event.target.value='';await refresh();setBusy(false);
  }
  async function download(name:string) {
    if(!supabase)return;
    const {data,error:downloadError}=await supabase.storage.from(bucket).download(prefix+name);
    if(downloadError){setError(downloadError.message);return;}
    const url=URL.createObjectURL(data);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  async function remove(name:string){if(!supabase || !window.confirm(`Delete ${name}?`))return;
    const {error:removeError}=await supabase.storage.from(bucket).remove([prefix+name]);
    if(removeError)setError(removeError.message);else await refresh();}
  return <PageFrame user={user} signOut={()=>{void supabase?.auth.signOut();}}><div className="page-container">
    <Link href={`/projects/${projectId}`} className="nav-link"><ArrowLeft size={16}/> Back to project</Link>
    <h1><HardDrive size={24}/> Project assets</h1><p>Upload images, PDFs, ZIP files and other binary assets (10 MB per file). Files are private to the project owner.</p>
    <input aria-label="Upload assets" type="file" multiple disabled={busy || !user} onChange={e=>void upload(e)}/>
    {error && <p role="alert" className="form-error">{error} — Check Storage SQL setup.</p>}
    <div style={{display:'grid',gap:10,marginTop:20}}>{paths.map(name=><div className="panel" key={name} style={{padding:12,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}><span style={{flex:1,overflowWrap:'anywhere'}}>{name}</span><button className="button button-quiet" onClick={()=>void download(name)}>Download</button><button className="button button-quiet" onClick={()=>void remove(name)}>Delete</button></div>)}</div>
  </div></PageFrame>;
}

type RepoFile = { id: string; user_id: string; project_id: string; path: string; content: string; created_at: string; updated_at: string };

function RepositoryPage({ user }: { user: User | null }) {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId ?? '';
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filePath, setFilePath] = useState('');
  const [content, setContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const uploadInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [previewOpen, setPreviewOpen] = useState(false);
  const previewHtml = (() => {
    const html = files.find(f => f.path === 'index.html' || f.path.endsWith('/index.html'))?.content ?? '';
    const css = files.filter(f => f.path.endsWith('.css')).map(f => f.content).join('\n');
    const js = files.filter(f => f.path.endsWith('.js') && !f.path.endsWith('.min.js')).map(f => f.content).join('\n');
    if (!html && !css && !js) return '';
    const base = html || '<!doctype html><html><head></head><body><h1>Veyrova Preview</h1></body></html>';
    const style = '<style>' + css + '</style>';
    const script = '<script>' + js + '</' + 'script>';
    return base.includes('</body>') ? base.replace('</body>', style + script + '</body>') : base + style + script;
  })();
  const selected = files.find((file) => file.id === selectedId) ?? null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    if (!user || !supabase || !projectId) {
      setLoading(false);
      return () => { active = false; };
    }
    void (async () => {
      const { data: projectData, error: projectError } = await supabase
        .from('projects').select(projectColumns).eq('id', projectId).eq('user_id', user.id).maybeSingle();
      if (!active) return;
      if (projectError || !projectData) {
        setError(projectError ? projectError.message : 'Project not found or access denied.');
        setLoading(false);
        return;
      }
      setProject(projectData as Project);
      const { data: fileData, error: fileError } = await supabase
        .from('veyrova_files').select('id,user_id,project_id,path,content,created_at,updated_at')
        .eq('project_id', projectId).eq('user_id', user.id).order('path', { ascending: true });
      if (!active) return;
      if (fileError) setError(fileError.message.includes('veyrova_files') || fileError.message.includes('schema cache')
        ? 'Repository storage is not set up yet. Run the SQL migration included in this project ZIP in Supabase SQL Editor, then refresh this page.'
        : fileError.message);
      else setFiles((fileData ?? []) as RepoFile[]);
      setLoading(false);
    })().catch((err: unknown) => {
      if (active) { setError(err instanceof Error ? err.message : 'Could not load repository.'); setLoading(false); }
    });
    return () => { active = false; };
  }, [user?.id, projectId]);

  function chooseFile(file: RepoFile) {
    setSelectedId(file.id);
    setFilePath(file.path);
    setContent(file.content);
    setCreating(false);
    setError('');
    setNotice('');
  }

  function newFile() {
    setSelectedId(null);
    setFilePath('src/App.tsx');
    setContent('// Start writing your code here\\n');
    setCreating(true);
    setError('');
    setNotice('');
  }

  async function saveFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !supabase || !project) return;
    const path = filePath.trim().replace(/^\/+|\/+$/g, '');
    if (!path || path.includes('..') || path.includes('\\') || path.length > 240) {
      setError('Enter a valid relative file path, for example src/App.tsx. Paths cannot contain .. or backslashes.');
      return;
    }
    if (!/\.[a-zA-Z0-9_-]+$/.test(path)) {
      setError('Please include a file extension, such as .ts, .tsx, .js, .json, .md, or .css.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (creating) {
        const { data, error: insertError } = await supabase.from('veyrova_files').insert({
          user_id: user.id, project_id: project.id, path, content,
        }).select('id,user_id,project_id,path,content,created_at,updated_at').single();
        if (insertError) throw insertError;
        const created = data as RepoFile;
        setFiles((items) => [...items, created].sort((a,b) => a.path.localeCompare(b.path)));
        setSelectedId(created.id);
        setCreating(false);
        setNotice('File created and saved.');
      } else if (selected) {
        const { data, error: updateError } = await supabase.from('veyrova_files')
          .update({ path, content }).eq('id', selected.id).eq('project_id', project.id).eq('user_id', user.id)
          .select('id,user_id,project_id,path,content,created_at,updated_at').maybeSingle();
        if (updateError) throw updateError;
        if (!data) throw new Error('File was not updated. Check ownership and repository policies.');
        const updated = data as RepoFile;
        setFiles((items) => items.map((item) => item.id === updated.id ? updated : item).sort((a,b) => a.path.localeCompare(b.path)));
        setSelectedId(updated.id);
        setNotice('Changes saved.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save file.';
      setError(msg.toLowerCase().includes('duplicate') ? 'A file with that path already exists in this project.' : msg);
    } finally { setSaving(false); }
  }

  function downloadFile(path: string, data: string) {
    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = path.split('/').pop() || 'file.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!user || !supabase || !project || chosen.length === 0) return;
    if (chosen.length > 100) { setError('Upload up to 100 files at once.'); return; }
    setUploading(true); setError(''); setNotice('');
    let uploaded = 0;
    const failures: string[] = [];
    const updatedFiles: RepoFile[] = [];
    for (const file of chosen) {
      const path = (file.webkitRelativePath || file.name).replace(/^\/+/, '');
      if (!path || path.length > 240 || path.split('/').some(part => !part || part === '.' || part === '..') || path.includes('\\')) {
        failures.push(`${path}: invalid path`); continue;
      }
      if (file.size > 1024 * 1024) { failures.push(`${path}: exceeds 1 MB text-file limit`); continue; }
      setUploadProgress(`Uploading ${uploaded + failures.length + 1} of ${chosen.length}: ${path}`);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.includes(0)) { failures.push(`${path}: binary files are not supported`); continue; }
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        const { data, error: saveError } = await supabase.from('veyrova_files').upsert({
          user_id: user.id, project_id: project.id, path, content: text,
        }, { onConflict: 'project_id,path' }).select('id,user_id,project_id,path,content,created_at,updated_at').single();
        if (saveError) throw saveError;
        updatedFiles.push(data as RepoFile);
        uploaded++;
      } catch (err) {
        failures.push(`${path}: ${err instanceof Error ? err.message : 'upload failed'}`);
      }
    }
    setFiles(items => {
      const byPath = new Map(items.map(item => [item.path, item]));
      for (const item of updatedFiles) byPath.set(item.path, item);
      return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
    });
    setUploading(false); setUploadProgress('');
    if (uploaded) setNotice(`${uploaded} file${uploaded === 1 ? '' : 's'} uploaded. Existing paths were updated.`);
    if (failures.length) setError(`${failures.length} file(s) failed: ${failures.slice(0, 5).join(' | ')}${failures.length > 5 ? ' …' : ''}`);
  }

  function exportProject() {
    if (!project) return;
    const payload = {
      format: 'veyrova-project-v1', project: { name: project.name, description: project.description },
      exportedAt: new Date().toISOString(),
      files: files.map(({ path, content }) => ({ path, content })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 70) || 'project'}-backup.json`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Backup exported with ${files.length} files.`);
  }

  async function importProject(event: ChangeEvent<HTMLInputElement>) {
    const backup = event.target.files?.[0];
    event.target.value = '';
    if (!backup || !user || !supabase || !project) return;
    if (backup.size > 12 * 1024 * 1024) { setError('Backup is too large (12 MB maximum).'); return; }
    setUploading(true); setError(''); setNotice('');
    try {
      const payload: unknown = JSON.parse(await backup.text());
      if (!payload || typeof payload !== 'object' || !('format' in payload) || payload.format !== 'veyrova-project-v1' || !('files' in payload) || !Array.isArray(payload.files)) {
        throw new Error('Invalid Veyrova backup JSON.');
      }
      const entries = payload.files as unknown[];
      if (entries.length > 100) throw new Error('Import at most 100 files per backup.');
      const records: { user_id: string; project_id: string; path: string; content: string }[] = [];
      const paths = new Set<string>();
      for (const item of entries) {
        if (!item || typeof item !== 'object' || !('path' in item) || !('content' in item) || typeof item.path !== 'string' || typeof item.content !== 'string') throw new Error('Invalid file entry in backup.');
        const path = item.path;
        if (path.length === 0 || path.length > 240 || path.includes('\\') || path.split('/').some(segment => !segment || segment === '.' || segment === '..') || paths.has(path)) throw new Error(`Invalid or duplicate path: ${path}`);
        if (new Blob([item.content]).size > 1024 * 1024) throw new Error(`${path} exceeds 1 MB.`);
        paths.add(path);
        records.push({ user_id: user.id, project_id: project.id, path, content: item.content });
      }
      if (!window.confirm(`Import ${records.length} files into ${project.name}? Files with matching paths will be replaced.`)) return;
      if (records.length) {
        const { error: importError } = await supabase.from('veyrova_files').upsert(records, { onConflict: 'project_id,path' });
        if (importError) throw importError;
      }
      const { data, error: reloadError } = await supabase.from('veyrova_files')
        .select('id,user_id,project_id,path,content,created_at,updated_at')
        .eq('project_id', project.id).eq('user_id', user.id).order('path');
      if (reloadError) throw reloadError;
      setFiles((data ?? []) as RepoFile[]);
      setSelectedId(null); setCreating(false); setNotice(`Imported ${records.length} files successfully.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not import backup.'); }
    finally { setUploading(false); setUploadProgress(''); }
  }

  async function deleteFile() {
    if (!user || !supabase || !project || !selected || !window.confirm(`Delete ${selected.path}?`)) return;
    setError(''); setNotice('');
    const { data, error: deleteError } = await supabase.from('veyrova_files').delete()
      .eq('id', selected.id).eq('project_id', project.id).eq('user_id', user.id).select('id').maybeSingle();
    if (deleteError) { setError(deleteError.message); return; }
    if (!data) { setError('File was not deleted. It may have been removed or access was denied.'); return; }
    setFiles((items) => items.filter((item) => item.id !== selected.id));
    setSelectedId(null); setFilePath(''); setContent(''); setNotice('File deleted.');
  }

  return <PageFrame user={user} signOut={() => supabase?.auth.signOut()}>
    <div className="page-eyebrow"><span className="eyebrow-line" /> REPOSITORY <span className="eyebrow-slash">/</span> FILE MANAGER</div>
    <div className="project-detail-back"><Link href={`/projects/${projectId}`} className="text-link"><ArrowLeft size={15} /> Back to project</Link></div>
    {!user && <section className="project-message-panel"><h1>Sign in to open this repository</h1><Link href="/auth" className="button button-primary">Sign in <ArrowRight size={15} /></Link></section>}
    {user && loading && <div className="project-detail-loading"><LoaderCircle className="spin" size={19} /> Loading repository…</div>}
    {user && !loading && error && !project && <section className="project-message-panel"><MessageBox>{error}</MessageBox></section>}
    {user && !loading && project && <section className="repo-page">
      <div className="repo-title-row">
        <div><span className="micro-label">PROJECT REPOSITORY</span><h1>{project.name}</h1><p>Private files · {files.length} {files.length === 1 ? 'file' : 'files'}</p></div>
        <div className="repo-upload-actions">
          <input ref={uploadInput} type="file" multiple hidden onChange={uploadFiles} aria-label="Choose files to upload" />
          <input ref={folderInput} type="file" multiple hidden {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)} onChange={uploadFiles} aria-label="Choose folder to upload" />
          <button className="button button-quiet" disabled={uploading} onClick={() => uploadInput.current?.click()}><Upload size={16} /> Upload files</button>
          <button className="button button-quiet" disabled={uploading} onClick={() => folderInput.current?.click()}><FolderPlus size={16} /> Upload folder</button>
          <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={importProject} aria-label="Import Veyrova backup" />
          <button className="button button-quiet" disabled={uploading} onClick={() => importInput.current?.click()}><Upload size={16} /> Import backup</button>
          <button className="button button-quiet" disabled={uploading || files.length === 0} onClick={exportProject}><Download size={16} /> Export backup</button>
          <button className="button button-primary" onClick={newFile}><FilePlus2 size={16} /> New file</button>
        </div>
      </div>
      {error && <MessageBox>{error}</MessageBox>}
      {notice && <MessageBox tone="success">{notice}</MessageBox>}
      {uploading && <p role="status" className="repo-note"><RefreshCw size={15} className="spin" /> {uploadProgress}</p>}
      <div className="repo-workspace">
        <aside className="repo-file-list">
          <div className="repo-file-list-head"><FolderPlus size={15} /> FILES <span>{files.length}</span></div>
          <input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search files…" aria-label="Search repository files" style={{ width: 'calc(100% - 24px)', margin: '12px', padding: '10px', borderRadius: 8, background: '#111820', color: 'inherit', border: '1px solid #39424f' }} />
          {files.length === 0 && <p className="repo-empty">No files yet. Create your first file.</p>}
          {files.filter(file => file.path.toLowerCase().includes(searchTerm.toLowerCase())).map((file) => <button key={file.id} className={`repo-file-item ${selectedId === file.id ? 'active' : ''}`} onClick={() => chooseFile(file)}><FileText size={15} /><span>{file.path}</span></button>)}
        </aside>
        <form className="repo-editor" onSubmit={saveFile}>
          {(selected || creating) ? <>
            <div className="repo-editor-toolbar"><label htmlFor="repo-file-path">File path</label><input id="repo-file-path" value={filePath} onChange={(event) => setFilePath(event.target.value)} placeholder="src/App.tsx" required /></div>
            <textarea className="repo-code-editor" aria-label="File contents" value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} placeholder="Write code here…" />
            <div className="repo-editor-footer"><span>{content.length} characters</span><div>{selected && <button type="button" className="button button-quiet" onClick={() => downloadFile(selected.path, content)}><Download size={15} /> Download</button>}{selected && <button type="button" className="button button-danger" onClick={deleteFile}><Trash2 size={15} /> Delete</button>}<button className="button button-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}{saving ? 'Saving…' : creating ? 'Create file' : 'Save changes'}</button></div></div>
          </> : <div className="repo-editor-empty"><FileCode2 size={30} /><h2>Select a file</h2><p>Choose a file on the left, or create a new one.</p><button type="button" className="button button-quiet" onClick={newFile}><Plus size={15} /> New file</button></div>}
        </form>
      </div>
      <section style={{ marginTop: 20 }}>
        <button type="button" className="button button-quiet" onClick={() => setPreviewOpen(v => !v)} disabled={!previewHtml}>{previewOpen ? 'Hide preview' : 'Live HTML preview'}</button>
        {previewOpen && previewHtml && <>
          <p className="repo-note">Sandboxed preview for saved HTML/CSS/plain JavaScript only. React, TypeScript, npm packages, backend APIs and multi-page routing are not compiled here. Scripts run in an isolated iframe without same-origin access.</p>
          <iframe title="Sandboxed HTML project preview" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={previewHtml} style={{ width: '100%', height: 450, border: '1px solid #39424f', borderRadius: 8, background: 'white' }} />
        </>}
      </section>
      <p className="repo-note">Text/code files up to 1 MB each are stored privately in Supabase. JSON backup import/export and file search are supported. Importing a matching path replaces its content. Binary files, ZIP import and Git commits/branches are not yet supported.</p>
    </section>}
  </PageFrame>;
}

function GoogleMark() {
  return <svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.88c-.58 2.96-2.26 5.47-4.76 7.16l7.73 6C44.36 38.03 46.98 31.88 46.98 24.55Z" />
    <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.94 23.94 0 0 0 0 21.56l7.98-6.19Z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.82l-7.73-6c-2.13 1.43-4.86 2.27-8.17 2.27-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
  </svg>;
}

function AuthPage({ user, callbackError }: { user: User | null; callbackError: string | null }) {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info' | 'success'; text: string } | null>(null);
  useEffect(() => { if (user) navigate('/'); }, [user, navigate]);
  useEffect(() => {
    if (callbackError) setMessage({ tone: 'error', text: callbackError });
  }, [callbackError]);

  async function continueWithGoogle() {
    setMessage(null);
    if (!supabase) {
      setMessage({ tone: 'error', text: 'Supabase is not configured yet. Add the project URL and publishable key, then follow the setup guide.' });
      return;
    }
    setGoogleBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        setMessage({ tone: 'error', text: `Google sign-in failed: ${error.message}` });
        setGoogleBusy(false);
      } else if (!data.url) {
        setMessage({ tone: 'error', text: 'Google sign-in failed: Supabase did not return a provider redirect URL. Check that Google is enabled in Supabase Auth.' });
        setGoogleBusy(false);
      }
    } catch (err) {
      setMessage({
        tone: 'error',
        text: `Google sign-in failed: ${err instanceof Error ? err.message : 'Please try again.'}`,
      });
      setGoogleBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!supabase) { setMessage({ tone: 'error', text: 'Supabase is not configured yet. Add the project URL and publishable key, then follow the setup guide.' }); return; }
    setBusy(true);
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
      setBusy(false);
      if (error) setMessage({ tone: 'error', text: error.message });
      else if (data.session) navigate('/');
      else setMessage({ tone: 'success', text: 'Account created. Check your inbox to confirm your email, then sign in.' });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) setMessage({ tone: 'error', text: error.message });
      else navigate('/');
    }
  }
  return <PageFrame user={user} signOut={() => supabase?.auth.signOut()}>
    <div className="auth-layout">
      <div className="auth-aside"><div className="page-eyebrow"><span className="eyebrow-line" /> YOUR WORKSPACE</div><h1>Good work<br />needs <em>space.</em></h1><p>Sign in to pick up where you left off. Your projects stay yours.</p>
        <div className="auth-quote"><span className="quote-mark">“</span><span>Less dashboard.<br />More building.</span><div className="quote-rule" /></div>
        <div className="auth-illustration"><div className="auth-stack stack-one" /><div className="auth-stack stack-two" /><div className="auth-stack stack-three" /><div className="stack-signal" /></div>
      </div>
      <section className="auth-card"><div className="auth-card-top"><span className="micro-label">{mode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</span><div className="auth-switch"><button className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setMessage(null); }} data-testid="tab-login">Sign in</button><button className={mode === 'signup' ? 'selected' : ''} onClick={() => { setMode('signup'); setMessage(null); }} data-testid="tab-signup">Create account</button></div></div>
        <h2>{mode === 'login' ? 'Back to your work.' : 'Make it yours.'}</h2><p className="auth-subtitle">{mode === 'login' ? 'Enter your details to continue.' : 'A few details, then you’re in.'}</p>
        {!supabase && <SetupCallout compact />}
        {message && <MessageBox tone={message.tone}>{message.text}</MessageBox>}
         <button type="button" className="google-auth-button" onClick={continueWithGoogle} disabled={busy || googleBusy || !supabase} data-testid="button-google-auth">
           {googleBusy ? <LoaderCircle className="spin" size={17} /> : <GoogleMark />}
           <span>{googleBusy ? 'Opening Google…' : 'Continue with Google'}</span>
         </button>
         <div className="auth-method-divider"><span>or continue with email</span></div>
         <form className="auth-form" onSubmit={submit}>
          <label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" data-testid="input-email" />
          <div className="password-label"><label htmlFor="password">Password</label>{mode === 'signup' && <span>At least 6 characters</span>}</div>
          <input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••" data-testid="input-password" />
          <button className="button button-primary auth-submit" type="submit" disabled={busy || googleBusy || !supabase} data-testid="button-auth-submit">{busy ? <><LoaderCircle className="spin" size={16} /> Please wait</> : mode === 'login' ? <>Sign in <ArrowRight size={16} /></> : <>Create account <ArrowRight size={16} /></>}</button>
        </form>
        <div className="auth-security"><ShieldCheck size={15} /> Your account is secured by Supabase Auth.</div>
      </section>
    </div>
  </PageFrame>;
}

function SetupPage({ user }: { user: User | null }) {
  return <PageFrame user={user} signOut={() => supabase?.auth.signOut()}>
    <div className="setup-heading"><div className="page-eyebrow"><span className="eyebrow-line" /> DOCUMENTATION <span className="eyebrow-slash">/</span> SETUP</div><h1>Bring your backend.<br /><span>We’ll keep it tidy.</span></h1><p>Veyrova connects directly to your Supabase project. Finish these three steps to enable accounts and private project storage.</p></div>
    <div className="setup-status"><span className={`setup-status-icon ${supabaseConfigured ? 'ready' : ''}`}>{supabaseConfigured ? <Check size={16} /> : <CircleHelp size={16} />}</span><div><strong>{supabaseConfigured ? 'Frontend configuration detected' : 'Frontend configuration missing'}</strong><p>{supabaseConfigured ? 'The project URL and publishable key are available to this app.' : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your environment.'}</p></div><span className={`setup-status-tag ${supabaseConfigured ? 'tag-ready' : ''}`}>{supabaseConfigured ? 'CONNECTED' : 'NEEDS CONFIG'}</span></div>

    <div className="setup-steps">
      <article className="setup-step"><div className="step-number">01</div><div className="step-body"><span className="micro-label">AUTHENTICATION</span><h2>Allow the app URL</h2><p>In Supabase, open <strong>Authentication → URL Configuration</strong>. Set your Site URL to the deployed Veyrova origin. Add your local development origin and deployed origin to the Redirect URLs allow-list so sign-in returns to this app.</p><p>To enable Google, open <strong>Authentication → Sign In / Providers → Google</strong> in Supabase. Create a Google OAuth web client, add the callback URL shown by Supabase as an authorized redirect URI in Google Cloud, then enter the client ID and client secret in Supabase’s Google provider settings. Keep the client secret in Supabase; never add it to Veyrova or frontend environment variables.</p><div className="step-note"><ShieldCheck size={16} /><span>Use only the Supabase project URL and publishable key in the frontend environment. Access is restricted by your Auth settings and row-level security.</span></div><div className="config-pair"><span><i>URL</i><code>VITE_SUPABASE_URL</code></span><span><i>KEY</i><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></span></div></div></article>
      <article className="setup-step"><div className="step-number">02</div><div className="step-body"><span className="micro-label">PROJECT STORAGE</span><h2>Use your existing projects table</h2><p>Veyrova connects to <strong>public.projects</strong> using the columns already in your Supabase project. This app does not create, replace, migrate, or seed the table, and it never overwrites existing project data.</p><div className="schema-columns" aria-label="Required projects table columns">{['id', 'user_id', 'name', 'description', 'created_at'].map((column) => <code key={column}>{column}</code>)}</div></div></article>
      <article className="setup-step"><div className="step-number">03</div><div className="step-body"><span className="micro-label">ROW-LEVEL SECURITY</span><h2>Keep every project private</h2><p>Keep the existing RLS policies enabled on <strong>public.projects</strong>. Policies should restrict each operation to authenticated rows where <code>user_id = auth.uid()</code>. Veyrova also scopes its own queries and writes to the signed-in user ID; it does not alter your policies.</p><div className="policy-list"><span><Check size={14} /> SELECT and DELETE only for the authenticated owner</span><span><Check size={14} /> INSERT requires user_id to match auth.uid()</span><span><Check size={14} /> UPDATE only for the authenticated owner</span></div></div></article>
    </div>
    <section className="setup-next"><div className="next-icon"><Code2 size={19} /></div><div><strong>Ready when you are.</strong><p>After configuring Supabase, return to your workspace and create your first project.</p></div><Link href="/" className="button button-primary" data-testid="button-back-projects">Go to projects <ArrowRight size={15} /></Link></section>
    <div className="setup-footnote">Veyrova doesn’t store your password. Authentication and project data stay in your Supabase project.</div>
  </PageFrame>;
}

function NotConfigured() {
  return <div className="loading-screen"><div className="loading-mark"><Brand compact /></div><span>Loading workspace</span></div>;
}


type GitHubRepo = { full_name: string; description: string | null; default_branch: string; html_url: string; stargazers_count: number };
type GitHubBranch = { name: string; commit: { sha: string } };
type GitHubCommit = { sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } | null } };
type GitHubTreeItem = { path: string; type: string; size?: number };
function GitHubExplorer({ user }: { user: User | null }) {
  const [input, setInput] = useState('');
  const [repo, setRepo] = useState<GitHubRepo | null>(null);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [branch, setBranch] = useState('');
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [tree, setTree] = useState<GitHubTreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<{ path: string; content: string } | null>(null);
  async function request<T>(url: string): Promise<T> {
    const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) {
      if (response.status === 403) throw new Error('GitHub API rate limit reached. Please try again later.');
      if (response.status === 404) throw new Error('Public repository not found. Private repositories need a separate secure OAuth backend.');
      throw new Error(`GitHub request failed (${response.status}).`);
    }
    return response.json() as Promise<T>;
  }
  async function loadRepository(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const match = input.trim().match(/^(?:https?:\/\/github\.com\/)?([a-zA-Z0-9-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?\/?$/);
    if (!match) { setError('Enter owner/repository or a GitHub repository URL.'); return; }
    setLoading(true); setError(''); setRepo(null); setFile(null); setTree([]); setCommits([]);
    try {
      const path = `${match[1]}/${match[2]}`;
      const result = await request<GitHubRepo>(`https://api.github.com/repos/${path}`);
      const items = await request<GitHubBranch[]>(`https://api.github.com/repos/${path}/branches?per_page=50`);
      setRepo(result); setBranches(items); setBranch(result.default_branch);
      await loadBranch(path, result.default_branch);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load repository.'); }
    finally { setLoading(false); }
  }
  async function loadBranch(path: string, selectedBranch: string) {
    setLoading(true); setError(''); setFile(null);
    try {
      const encoded = encodeURIComponent(selectedBranch);
      const [commitList, treeResult] = await Promise.all([
        request<GitHubCommit[]>(`https://api.github.com/repos/${path}/commits?sha=${encoded}&per_page=20`),
        request<{ tree: GitHubTreeItem[]; truncated: boolean }>(`https://api.github.com/repos/${path}/git/trees/${encoded}?recursive=1`)
      ]);
      setCommits(commitList);
      setTree(treeResult.tree.filter(item => item.type === 'blob').slice(0, 1000));
      if (treeResult.truncated) setError('This repository is large; GitHub returned a partial file list.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load branch.'); }
    finally { setLoading(false); }
  }
  async function openFile(path: string) {
    if (!repo) return;
    setLoading(true); setError('');
    try {
      const response = await fetch(`https://raw.githubusercontent.com/${repo.full_name}/${encodeURIComponent(branch)}/${path.split('/').map(encodeURIComponent).join('/')}`);
      if (!response.ok) throw new Error(`Could not read file (${response.status}).`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 1024 * 1024) throw new Error('File preview is limited to 1 MB.');
      const data = new Uint8Array(bytes);
      if (data.includes(0)) throw new Error('Binary files cannot be previewed.');
      setFile({ path, content: new TextDecoder('utf-8', { fatal: true }).decode(data) });
    } catch (err) { setError(err instanceof Error ? err.message : 'Preview unavailable.'); }
    finally { setLoading(false); }
  }
  return <PageFrame user={user} signOut={() => supabase?.auth.signOut()}>
    <div className="page-eyebrow">GITHUB / PUBLIC REPOSITORY EXPLORER</div>
    <h1>GitHub Explorer</h1>
    <p>Browse public GitHub repositories, branches, recent commits and source files. Read-only: no GitHub token is stored in the browser.</p>
    <form onSubmit={loadRepository} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '20px 0' }}>
      <input aria-label="GitHub repository" value={input} onChange={e => setInput(e.target.value)} placeholder="owner/repository" style={{ flex: '1 1 240px', padding: 12, borderRadius: 8 }} required />
      <button className="button button-primary" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Open repository'}</button>
    </form>
    {error && <MessageBox>{error}</MessageBox>}
    {repo && <>
      <h2><a href={repo.html_url} target="_blank" rel="noopener noreferrer">{repo.full_name} ↗</a></h2>
      <p>{repo.description || 'No description'} · ★ {repo.stargazers_count}</p>
      <label htmlFor="github-branch">Branch: </label>
      <select id="github-branch" value={branch} onChange={e => { setBranch(e.target.value); void loadBranch(repo.full_name, e.target.value); }} style={{ padding: 8, margin: 10 }}>
        {branches.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24, marginTop: 20 }}>
        <section><h3>Files ({tree.length})</h3><div style={{ maxHeight: 360, overflow: 'auto' }}>
          {tree.map(item => <button type="button" key={item.path} onClick={() => void openFile(item.path)} className="repo-file-item" style={{ width: '100%', textAlign: 'left' }}><FileText size={14}/>{item.path}</button>)}
        </div></section>
        <section><h3>Recent commits</h3><div style={{ maxHeight: 360, overflow: 'auto' }}>
          {commits.map(item => <p key={item.sha}><a href={item.html_url} target="_blank" rel="noopener noreferrer">{item.sha.slice(0,7)}</a> — {item.commit.message.split('\n')[0]}</p>)}
        </div></section>
      </div>
      {file && <section style={{ marginTop: 24 }}><h3>{file.path}</h3><textarea readOnly className="repo-code-editor" aria-label="GitHub source preview" value={file.content} style={{ width: '100%', minHeight: 320 }} /></section>}
    </>}
    <p className="repo-note">Public GitHub REST API only. Private repository OAuth, pushes, merges and pull requests require a secure backend and are not implemented.</p>
  </PageFrame>;
}


type DataRow = Record<string, unknown>;
const explorerTables = [
  { value: 'projects', label: 'Projects', fields: 'id,name,description,created_at' },
  { value: 'veyrova_files', label: 'Code files', fields: 'id,project_id,path,created_at,updated_at' },
  { value: 'veyrova_issues', label: 'Issues', fields: 'id,project_id,title,status,created_at' },
] as const;
type ExplorerTable = (typeof explorerTables)[number]['value'];
function DataExplorer({ user }: { user: User | null }) {
  const [tableName, setTableName] = useState<ExplorerTable>('projects');
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastLoaded, setLastLoaded] = useState('');
  useEffect(() => {
    let active = true;
    setRows([]);
    setError('');
    if (!supabase || !user) return;
    const table = explorerTables.find(item => item.value === tableName);
    if (!table) return;
    setLoading(true);
    void supabase.from(table.value).select(table.fields).eq('user_id', user.id).limit(100).then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      else {
        setRows((data ?? []) as unknown as DataRow[]);
        setLastLoaded(new Date().toLocaleTimeString());
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [tableName, user?.id]);
  function exportRows() {
    const json = JSON.stringify({ table: tableName, exported_at: new Date().toISOString(), rows }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `veyrova-${tableName}-export.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return <PageFrame user={user} signOut={() => supabase?.auth.signOut()}>
    <div className="page-eyebrow">DATABASE / SECURE READ-ONLY VIEW</div>
    <h1>Data Explorer</h1>
    <p>Inspect your own projects, code file metadata and issues. Access is controlled by Supabase RLS. This view does not run arbitrary SQL or expose file contents.</p>
    {!user ? <MessageBox tone="info">Sign in to view your project data.</MessageBox> : !supabase ? <SetupCallout /> : <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '20px 0', alignItems: 'center' }}>
        <label htmlFor="data-explorer-table">Table</label>
        <select id="data-explorer-table" value={tableName} onChange={e => setTableName(e.target.value as ExplorerTable)} style={{ padding: 12, borderRadius: 8 }}>
          {explorerTables.map(table => <option key={table.value} value={table.value}>{table.label}</option>)}
        </select>
        <button className="button button-quiet" type="button" disabled={!rows.length} onClick={exportRows}><Download size={16} /> Export JSON</button>
      </div>
      {error && <MessageBox>{error}. Make sure the required SQL migrations have been applied and RLS is configured.</MessageBox>}
      {loading ? <p>Loading data…</p> : <>
        <p>{rows.length} rows (maximum 100){lastLoaded ? ` · Loaded ${lastLoaded}` : ''}</p>
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border, #444)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{explorerTables.find(t => t.value === tableName)?.fields.split(',').map(column => <th key={column} style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #777' }}>{column}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}>{explorerTables.find(t => t.value === tableName)?.fields.split(',').map(column => <td key={column} style={{ padding: 10, borderBottom: '1px solid #777', maxWidth: 320, overflowWrap: 'anywhere' }}>{row[column] == null ? '—' : String(row[column])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </>}
    </>}
  </PageFrame>;
}

function Router() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    let alive = true;
    const callbackParams = [
      new URLSearchParams(window.location.search),
      new URLSearchParams(window.location.hash.replace(/^#/, '')),
    ];
    const callbackError = callbackParams
      .map((params) => params.get('error_description') || params.get('error'))
      .find(Boolean);
    if (callbackError) {
      setAuthError(`Google sign-in failed: ${callbackError}`);
      window.history.replaceState(window.history.state, document.title, window.location.pathname);
    }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUser(session?.user ?? null);
      if (session) setAuthError(null);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      setUser(data.session?.user ?? null);
      if (error && !callbackError) setAuthError(`Could not complete sign-in: ${error.message}`);
      setAuthLoading(false);
    }).catch((error: unknown) => {
      if (!alive) return;
      if (!callbackError) {
        setAuthError(error instanceof Error ? `Could not restore your session: ${error.message}` : 'Could not restore your session. Please try signing in again.');
      }
      setAuthLoading(false);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);
  if (authLoading) return <NotConfigured />;
  return <RoutedErrorBoundary>
    <Switch>
      <Route path="/projects/:projectId/issues" component={() => <IssuesPage user={user} />} />
      <Route path="/projects/:projectId/assets" component={() => <AssetsPage user={user} />} />
      <Route path="/projects/:projectId/repository" component={() => <RepositoryPage user={user} />} />
      <Route path="/projects/:projectId" component={() => <ProjectRoute user={user} />} />
      <Route path="/" component={() => <Home user={user} authError={authError} />} />
      <Route path="/auth" component={() => <AuthPage user={user} callbackError={authError} />} />
      <Route path="/setup" component={() => <SetupPage user={user} />} />
      <Route path="/github" component={() => <GitHubExplorer user={user} />} />
      <Route path="/data" component={() => <DataExplorer user={user} />} />
      <Route component={NotFound} />
    </Switch>
  </RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
