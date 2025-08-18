// types/poster.ts
export interface PosterSection { icon: string; heading: string; body: string }
export interface PosterSide { title: string; bullets: string[] }
export interface PosterGridItem { icon: string; title: string; text: string }

export interface Poster {
  title: string
  subtitle?: string
  heroIcon?: string
  sections: PosterSection[]
  compare?: { left: PosterSide; right: PosterSide }
  grid?: PosterGridItem[]
  takeaway?: { summary: string; question?: string }
}
