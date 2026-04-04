import { Hono } from 'hono';
import { modelsService } from '../services/models-service';
import type { HonoContext } from '../types/context';

const models = new Hono<HonoContext>();

/**
 * GET /api/models/version
 * Returns the current models configuration version
 */
models.get('/version', (c) => {
  const version = modelsService.getVersion();
  return c.json(version);
});

/**
 * GET /api/models/configs
 * Returns the complete models configuration
 */
models.get('/configs', (c) => {
  const configs = modelsService.getConfigs();
  return c.json(configs);
});

/**
 * GET /api/models/:modelKey
 * Returns a specific model configuration
 */
models.get('/:modelKey', (c) => {
  const modelKey = c.req.param('modelKey');
  const model = modelsService.getModel(modelKey);

  if (!model) {
    return c.json({ error: 'Model not found' }, 404);
  }

  return c.json(model);
});

/**
 * GET /api/models
 * Returns a list of all model keys
 */
models.get('/', (c) => {
  const keys = modelsService.getModelKeys();
  const count = modelsService.getModelsCount();

  return c.json({
    count,
    models: keys,
  });
});

export default models;
