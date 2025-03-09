import { authenticationFlow } from '../services/auth.js';

export const loginCommand = {
  name: 'login',
  description: 'Login to DBDraw CLI and save access token securely',
  action: async () => {
    await authenticationFlow();
  }
};
