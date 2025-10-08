import { Reaction, User, Article } from '@lib/models';
import { ReactionsEnum } from '@lib/models/enums';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Reaction Model', () => {
  let user: User;
  let article: Article;

  beforeEach(async () => {
    user = await User.create({ email: 'test@example.com' });
    article = await Article.create({ content: 'Test Article' });
  });

  it('do not allow duplicate reactions for the same user/article', async () => {
    const reaction = await Reaction.create({
      user: user._id,
      article: article._id,
      reaction: ReactionsEnum.SKIP,
    });
    await expect(
      Reaction.create({
        user: user._id,
        article: article._id,
        reaction: ReactionsEnum.UPVOTE,
      })
    ).rejects.toThrow();

    reaction.set({
      user: user._id,
      article: article._id,
      reaction: ReactionsEnum.UPVOTE,
    });
    await expect(reaction.save()).resolves.toBeDefined();
  });

  it('require user and article fields', async () => {
    await expect(
      Reaction.create({
        reaction: ReactionsEnum.ACKNOWLEDGED,
      })
    ).rejects.toThrow();
  });

  it('find reactions by user', async () => {
    const original = await Reaction.create({
      user: user._id,
      article: article._id,
      reaction: ReactionsEnum.UPVOTE,
    });
    const found = await Reaction.find().findByUser(user._id).exec();
    expect(found[0].id).toBe(original.id);
  });

  it('find reactions by article', async () => {
    const original = await Reaction.create({
      user: user._id,
      article: article._id,
      reaction: ReactionsEnum.SKIP,
    });
    const found = await Reaction.find().findByArticle(article._id).exec();
    expect(found[0].id).toBe(original.id);
  });

  it('can add reaction to an article', async () => {
    await article.addReaction(1, user._id);
    const reactions = await Reaction.find({ user: user._id, article: article._id });
    expect(reactions[0].reaction).toBe(1);
  });
});
