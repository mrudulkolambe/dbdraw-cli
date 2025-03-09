import { intro, text, isCancel, outro, confirm } from '@clack/prompts';
import chalk from 'chalk';
import keytar from 'keytar';
import fetch from 'node-fetch';
import ora from 'ora';
import isOnline from 'is-online';
import { SERVICE_NAME, ACCOUNT_NAME, webURL } from '../utils/constants.js';

export const saveToken = async (token) => {
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
};

export const loadToken = async () => {
  return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
};

export const deleteToken = async () => {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
};

export const verifyToken = async (token) => {
  try {
    const spinner = ora('Verifying token...').start();

    const response = await fetch(`${webURL}/api/token/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      spinner.fail('Token verification failed.');
      await deleteToken(); // Automatically delete the token if verification fails
      throw new Error(`${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.valid) {
      spinner.fail('Token is invalid or revoked.');
      await deleteToken(); // Automatically delete the token if it's invalid
      throw new Error('Invalid or revoked token');
    }
    
    spinner.succeed('Token verified successfully.');
    return data;
  } catch (error) {
    throw new Error(`Something went wrong, Please try again`);
  }
};

export const authenticationFlow = async () => {
  intro(chalk.green('Welcome to the DBDraw CLI'));

  const existingToken = await loadToken();

  if (existingToken) {
    try {
      // Verify if the existing token is still valid
      const online = await isOnline();
      if (online) {
        const data = await verifyToken(existingToken);
        if (data.valid) {
          console.log(chalk.blue(`You are already authenticated as ${data.user.username}.`));
          
          const logout = await confirm({
            message: 'Do you want to log out?',
          });

          if (isCancel(logout)) {
            outro(chalk.yellow('Operation canceled.'));
            process.exit(0);
          }

          if (logout) {
            await deleteToken();
            outro(chalk.green('You have been logged out.'));
            process.exit(0);
          } else {
            outro(chalk.blue('You are still logged in.'));
            process.exit(0);
          }
        }
      }
    } catch (error) {
      // Token verification failed, it's already been deleted in verifyToken
      console.log(chalk.red('Your previous session has expired. Please log in again.'));
      // Continue to login flow
    }
  }

  const token = await text({
    message: 'Enter your access token:',
    placeholder: 'Right-click to paste your token here',
    validate: (value) => (value.trim() ? undefined : 'Token cannot be empty'),
  });

  if (isCancel(token)) {
    outro(chalk.yellow('Operation canceled.'));
    process.exit(0);
  }

  try {
    const online = await isOnline();
    if (!online) {
      outro(chalk.red('No internet connection. Please try again later.'));
      process.exit(1);
    }

    const data = await verifyToken(token);

    if (data.valid) {
      await saveToken(token);
      outro(chalk.green(`Authenticated as ${data.user.username}`));
    } else {
      outro(chalk.red('Invalid token. Please try again.'));
      process.exit(1);
    }
  } catch (error) {
    outro(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
};
