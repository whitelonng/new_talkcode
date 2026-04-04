Custom tool SDK usage

import { toolHelper } from '@talkcody/custom-tool';

export default toolHelper({
  name: 'my-tool',
  description: { en: '...', zh: '...' },
  args: z.object({ ... }),
  execute: async (params, context) => ({ ... }),
  ui: {
    Doing: (params) => <div />, 
    Result: (result, params) => <div />,
  },
});
