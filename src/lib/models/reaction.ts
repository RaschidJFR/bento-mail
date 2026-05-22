import type { InferRootRow } from '@prisma-next/mongo-orm';
import type { Contract } from '../../../prisma/contract.d';
import { db } from '../../../prisma/db';
import type { ReactionsEnum } from './enums';

export type IReaction = Omit<InferRootRow<Contract, 'Reaction'>, 'reaction'> & {
  reaction: ReactionsEnum;
};

export const Reaction = db.orm.reactions;
