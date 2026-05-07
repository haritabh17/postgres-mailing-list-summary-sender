import { SHORT_LINK_DOMAIN } from './constants.ts'

export function resolveDiscussionLinks(discussion: any): { threadUrl: string | null, redirectSlug: string | null } {
  const posts: any[] = discussion.full_content || []

  let redirectSlug: string | null = null
  for (const post of posts) {
    if (post?.redirect_slug) {
      redirectSlug = post.redirect_slug
      break
    }
  }

  let threadUrl: string | null = null
  if (redirectSlug) {
    threadUrl = `${SHORT_LINK_DOMAIN}/t/${redirectSlug}`
  } else {
    for (let i = posts.length - 1; i >= 0; i--) {
      if (posts[i]?.thread_url) {
        threadUrl = posts[i].thread_url
        break
      }
    }
  }

  return {
    threadUrl,
    redirectSlug
  }
}