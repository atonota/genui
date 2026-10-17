import type { JsonValue } from '../contracts';
import { validateQueryIntent, type QuerySource, type QueryToolId } from '../definitions';
import { assertPlainJSON } from '../policy';

/** Optional Frappe host adapter; the core query port never imports it. */
export function createFrappeQuerySource({
  audience,
  call,
}: {
  audience: 'panel' | 'frontpage';
  call: (
    method: 'genux_genux.api.run_panel_query' | 'genux_genux.api.run_public_query',
    args: { tool_id: QueryToolId; parameters: Readonly<Record<string, JsonValue>> },
    signal?: AbortSignal,
  ) => Promise<unknown>;
}): QuerySource {
  return {
    audience,
    mode: 'host',
    async run(input, signal) {
      const query = validateQueryIntent(input, audience);
      const response = await call(
        audience === 'panel'
          ? 'genux_genux.api.run_panel_query'
          : 'genux_genux.api.run_public_query',
        { tool_id: query.toolId, parameters: query.params },
        signal,
      );
      assertPlainJSON(response);
      if (
        !response ||
        typeof response !== 'object' ||
        Array.isArray(response) ||
        !Object.hasOwn(response, 'message')
      )
        throw new Error('Frappe response envelope is invalid.');
      const data = response.message;
      assertPlainJSON(data);
      return data;
    },
  };
}
