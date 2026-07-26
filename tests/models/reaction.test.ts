import { Reaction, User, Article } from '@lib/models';
import { ReactionsEnum } from '@lib/models/enums';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Reaction Model', () => {
  let userId: string;
  let articleId: string;

  beforeEach(async () => {
    const user = await User.create({
      email: 'test@example.com',
      name: null,
      aliasEmail: null,
      image: null,
    });
    const article = await Article.create({
      content: 'Test Article',
      header: '',
      sourceName: '',
      url: null,
      date: null,
      coverImg: null,
      summaries: null,
      linkedArticles: null,
      lastError: null,
    });
    userId = String(user._id);
    articleId = String(article._id);
  });

  it('do not allow duplicate reactions for the same user/article', async () => {
    const reaction = await Reaction.create({
      user: userId,
      article: articleId,
      reaction: ReactionsEnum.SKIP,
      date: null,
    });
    await expect(
      Reaction.create({
        user: userId,
        article: articleId,
        reaction: ReactionsEnum.UPVOTE,
        date: null,
      }),
    ).rejects.toThrow();

    await expect(
      Reaction.where({ _id: reaction._id }).update({ reaction: ReactionsEnum.UPVOTE }),
    ).resolves.toBeDefined();
  });

  it('find reactions by user', async () => {
    const original = await Reaction.create({
      user: userId,
      article: articleId,
      reaction: ReactionsEnum.UPVOTE,
      date: null,
    });
    const found = await Reaction.where({ user: userId }).first();
    expect(String(found?._id)).toBe(String(original._id));
  });

  it('find reactions by article', async () => {
    const original = await Reaction.create({
      user: userId,
      article: articleId,
      reaction: ReactionsEnum.SKIP,
      date: null,
    });
    const found = await Reaction.where({ article: articleId }).all().toArray();
    expect(String(found[0]?.article)).toBe(String(original.article));
  });
});
