import { genSaltSync, hashSync } from 'bcrypt-ts';
import { after } from 'next/server';
import { createResumableStreamContext, ResumableStreamContext } from 'resumable-stream';

export function generateHashedPassword(password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  return hash;
}

export const maxDuration = 60;
let globalStreamContext: ResumableStreamContext | null = null;


export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}