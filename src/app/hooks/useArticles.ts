import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import type { IArticle, INewsletter } from '@lib/models';
import { getSocket } from './getSocket';

interface ArticleChange {
  _id: IArticle['_id'];
  data: IArticle;
}

type NewsletterWithArticles = Omit<INewsletter, 'articles'> & {
  articles?: IArticle[];
};

function extractArticles(newsletter: NewsletterWithArticles) {
  return (newsletter.articles || []).filter((a) => typeof a !== 'string');
}

export function useArticles(newsletter: NewsletterWithArticles): [IArticle[], Dispatch<SetStateAction<IArticle[]>>] {
  const [articles, setArticles] = useState<IArticle[]>(() => (newsletter.articles || []));

  useEffect(() => {
    setArticles(extractArticles(newsletter));
  }, [newsletter._id]);

  useEffect(() => {
    const handler = ({ _id: articleId, data: art }: ArticleChange) => {
      return art
        ? setArticles((prev) => findAndUpdateElement(articleId, art, prev))
        : setArticles((prev) => findAndRemoveElement(articleId, prev));
    };

    const socket = getSocket();
    if (!socket) return;

    socket.emit('joinNewsletter', newsletter._id);
    socket.on('articleChanged', handler);

    // Clean up on unmount / newsletter change: remove listener and leave room
    return () => {
      socket.off('articleChanged', handler);
      socket.emit('leaveNewsletter', newsletter._id); // Not implemented server-side yet
    };
  }, [newsletter._id]);

  return [articles, setArticles];
}

function findAndUpdateElement(articleId: IArticle['_id'], updatedArticle: IArticle, articles: IArticle[]) {
  const i = articles.findIndex((art) => art._id === articleId);
  if (i >= 0) {
    articles = articles.map((art) => (art._id === articleId ? updatedArticle : art));
  } else {
    articles = [...articles, updatedArticle];
  }
  return articles;
}

function findAndRemoveElement(articleId: IArticle['_id'], articles: IArticle[]) {
  articles = articles.filter((a) => a._id !== articleId);
  return articles;
}
