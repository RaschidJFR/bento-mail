/**
 * Enum representing possible reactions to an article.
 */
export enum ReactionsEnum {
  /**
   * A problem occurred while processing the article (e.g., extraction failure).
   */
  PROBLEM = -2,
  /**
   * The article is not relevant to the user.
   */
  SKIP = -1,
  /**
   * The user has seen the article but has not expressed a clear preference.
   */
  ACKNOWLEDGED = 1,
  /**
   * The article is relevant to the user.
   */
  UPVOTE = 2,
}