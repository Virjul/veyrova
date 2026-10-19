export type MockProject = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type Operation = 'select' | 'insert' | 'update' | 'delete';
type RequestRecord = {
  operation: Operation;
  filters: Array<[string, unknown]>;
  values?: Record<string, unknown>;
};

export const signedInUser = {
  id: 'user-owner',
  email: 'owner@example.test',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-10-19T00:00:00.000Z',
};

export const requests: RequestRecord[] = [];
export const deniedOperations = new Set<Operation>();

let projects: MockProject[] = [];
let nextProjectId = 1;

export function resetSupabaseMock(options: {
  projects?: MockProject[];
  denied?: Operation[];
} = {}) {
  projects = (options.projects ?? []).map((project) => ({ ...project }));
  nextProjectId = projects.length + 1;
  requests.length = 0;
  deniedOperations.clear();
  options.denied?.forEach((operation) => deniedOperations.add(operation));
}

function errorFor(operation: Operation) {
  if (!deniedOperations.has(operation)) return null;
  return {
    code: '42501',
    message: 'new row violates row-level security policy for table "projects"',
  };
}

function makeBuilder() {
  let operation: Operation = 'select';
  let values: Record<string, unknown> | undefined;
  let filters: Array<[string, unknown]> = [];
  let selectedColumns: string | undefined;

  const matches = (project: MockProject) =>
    filters.every(([column, value]) => project[column as keyof MockProject] === value);

  const execute = async (single = false) => {
    requests.push({
      operation,
      filters: [...filters],
      ...(values ? { values: { ...values } } : {}),
    });

    const error = errorFor(operation);
    if (error) return { data: null, error };

    if (operation === 'insert') {
      projects.push({
        id: `project-${nextProjectId++}`,
        user_id: String(values?.user_id),
        name: String(values?.name),
        description: (values?.description as string | null) ?? null,
        created_at: '2026-10-19T00:00:00.000Z',
      });
      return { data: null, error: null };
    }

    if (operation === 'update') {
      const target = projects.find(matches);
      if (!target) return { data: null, error: null };
      Object.assign(target, values);
      return { data: single ? { ...target } : [{ ...target }], error: null };
    }

    if (operation === 'delete') {
      const index = projects.findIndex(matches);
      if (index < 0) return { data: null, error: null };
      const [deleted] = projects.splice(index, 1);
      const data = selectedColumns === 'id' ? { id: deleted.id } : { ...deleted };
      return { data: single ? data : [data], error: null };
    }

    const matchingProjects = projects.filter(matches).map((project) => ({ ...project }));
    return {
      data: single ? matchingProjects[0] ?? null : matchingProjects,
      error: null,
    };
  };

  const builder = {
    select(columns: string) {
      selectedColumns = columns;
      return builder;
    },
    insert(payload: Record<string, unknown>) {
      operation = 'insert';
      values = payload;
      return builder;
    },
    update(payload: Record<string, unknown>) {
      operation = 'update';
      values = payload;
      return builder;
    },
    delete() {
      operation = 'delete';
      return builder;
    },
    eq(column: string, value: unknown) {
      filters = [...filters, [column, value]];
      return builder;
    },
    order() {
      return builder;
    },
    maybeSingle() {
      return execute(true);
    },
    then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
      return execute().then(resolve, reject);
    },
  };

  return builder;
}

export const supabase = {
  auth: {
    async getSession() {
      return { data: { session: { user: signedInUser } }, error: null };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async signOut() {
      return { error: null };
    },
  },
  from(table: string) {
    if (table !== 'projects') throw new Error(`Unexpected table: ${table}`);
    return makeBuilder();
  },
};
