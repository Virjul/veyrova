import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import {
  deniedOperations,
  requests,
  resetSupabaseMock,
  signedInUser,
  type MockProject,
} from './mock-supabase';

vi.mock('../src/lib/supabase', async () => {
  const mock = await import('./mock-supabase');
  return { supabase: mock.supabase, supabaseConfigured: true };
});

const foreignProject: MockProject = {
  id: 'foreign-project',
  user_id: 'user-someone-else',
  name: 'Not your project',
  description: 'Must remain private',
  created_at: '2026-10-18T00:00:00.000Z',
};

function setPath(path: string) {
  window.history.replaceState({}, '', path);
}

beforeEach(() => {
  resetSupabaseMock({ projects: [foreignProject] });
  setPath('/');
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('project persistence and account scoping', () => {
  it('creates, reloads, opens, edits, reloads, and deletes through the project UI', async () => {
    const user = userEvent.setup();
    let app = render(<App />);

    expect(await screen.findByText('Your next thing starts here.')).toBeInTheDocument();
    expect(screen.queryByText(foreignProject.name)).not.toBeInTheDocument();

    await user.click(screen.getByTestId('button-create-first'));
    await user.type(screen.getByTestId('input-project-name'), 'Fieldnotes');
    await user.type(screen.getByTestId('input-project-description'), 'Research log');
    await user.click(screen.getByTestId('button-save-project'));
    expect(await screen.findByTestId('project-row-project-2')).toHaveTextContent('Fieldnotes');
    expect(requests.find((request) => request.operation === 'insert')?.values).toMatchObject({
      user_id: signedInUser.id,
      name: 'Fieldnotes',
      description: 'Research log',
    });

    app.unmount();
    app = render(<App />);
    const projectRow = await screen.findByTestId('project-row-project-2');
    expect(projectRow).toHaveTextContent('Fieldnotes');
    expect(projectRow).toHaveTextContent('Research log');

    await user.click(within(projectRow).getByTestId('button-open-project-project-2'));
    expect(await screen.findByRole('heading', { name: 'Fieldnotes' })).toBeInTheDocument();
    await user.click(screen.getByTestId('button-edit-project'));
    const nameInput = screen.getByTestId('input-edit-project-name');
    const descriptionInput = screen.getByTestId('input-edit-project-description');
    await user.clear(nameInput);
    await user.type(nameInput, 'Fieldnotes 2');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Updated research log');
    await user.click(screen.getByTestId('button-save-project-edit'));
    expect(await screen.findByRole('heading', { name: 'Fieldnotes 2' })).toBeInTheDocument();
    expect(requests.find((request) => request.operation === 'update')?.filters).toContainEqual([
      'user_id',
      signedInUser.id,
    ]);

    app.unmount();
    app = render(<App />);
    expect(await screen.findByRole('heading', { name: 'Fieldnotes 2' })).toBeInTheDocument();
    expect(screen.getByText('Updated research log')).toBeInTheDocument();

    await user.click(screen.getByTestId('button-delete-project'));
    expect(await screen.findByText('Project deleted.')).toBeInTheDocument();
    expect(requests.find((request) => request.operation === 'delete')?.filters).toContainEqual([
      'user_id',
      signedInUser.id,
    ]);

    await user.click(screen.getByTestId('button-project-deleted-back'));
    expect(await screen.findByText('Your next thing starts here.')).toBeInTheDocument();
    expect(screen.queryByText('Fieldnotes 2')).not.toBeInTheDocument();

    const reads = requests.filter((request) => request.operation === 'select');
    expect(reads.length).toBeGreaterThan(0);
    for (const request of reads) {
      expect(request.filters).toContainEqual(['user_id', signedInUser.id]);
    }
    expect(requests.filter((request) => request.operation === 'update' || request.operation === 'delete')
      .every((request) => request.filters.some(([column, value]) =>
        column === 'user_id' && value === signedInUser.id,
      ))).toBe(true);
  });

  it('does not reveal another account’s project on its direct URL', async () => {
    setPath(`/projects/${foreignProject.id}`);
    render(<App />);

    expect(await screen.findByText('Project not found, or you do not have permission to view it.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: foreignProject.name })).not.toBeInTheDocument();
    expect(requests.some((request) =>
      request.operation === 'select' &&
      request.filters.some(([column, value]) => column === 'user_id' && value === signedInUser.id) &&
      request.filters.some(([column, value]) => column === 'id' && value === foreignProject.id),
    )).toBe(true);
  });

  it('explains when row-level security blocks project reads', async () => {
    resetSupabaseMock({ projects: [foreignProject], denied: ['select'] });
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Supabase blocked this request to load projects.',
    );
    expect(requests.filter((request) => request.operation === 'select').every((request) =>
      request.filters.some(([column, value]) =>
        column === 'user_id' && value === signedInUser.id,
      ),
    )).toBe(true);
  });

  it('explains RLS failures for create, edit, and delete instead of reporting success', async () => {
    const ownedProject: MockProject = {
      id: 'owned-project',
      user_id: signedInUser.id,
      name: 'Existing project',
      description: 'Before edit',
      created_at: '2026-10-17T00:00:00.000Z',
    };
    resetSupabaseMock({ projects: [ownedProject], denied: ['insert', 'update', 'delete'] });
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByTestId(`project-row-${ownedProject.id}`)).toBeInTheDocument();

    await user.click(screen.getByTestId('button-new-project'));
    await user.type(screen.getByTestId('input-project-name'), 'Blocked project');
    await user.click(screen.getByTestId('button-save-project'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Supabase blocked this request to create a project.',
    );
    await user.click(screen.getByTestId('button-close-create'));

    await user.click(screen.getByTestId(`button-open-project-${ownedProject.id}`));
    await user.click(await screen.findByTestId('button-edit-project'));
    await user.click(screen.getByTestId('button-save-project-edit'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Supabase blocked this request to edit this project.',
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByTestId('button-delete-project'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Supabase blocked this request to delete this project.',
    );
    expect(screen.getByRole('heading', { name: 'Existing project' })).toBeInTheDocument();
    expect(deniedOperations).toEqual(new Set(['insert', 'update', 'delete']));
  });
});
