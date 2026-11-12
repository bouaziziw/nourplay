import { AgeRating } from '@nourplay/db'

const AGE_RATING_MAP: Record<string, AgeRating[]> = {
  AGE_0_3:   [AgeRating.ALL],
  AGE_4_6:   [AgeRating.ALL, AgeRating.AGE_4_PLUS],
  AGE_7_9:   [AgeRating.ALL, AgeRating.AGE_4_PLUS, AgeRating.AGE_7_PLUS],
  AGE_10_12: [AgeRating.ALL, AgeRating.AGE_4_PLUS, AgeRating.AGE_7_PLUS, AgeRating.AGE_10_PLUS],
  AGE_13_15: [AgeRating.ALL, AgeRating.AGE_4_PLUS, AgeRating.AGE_7_PLUS, AgeRating.AGE_10_PLUS, AgeRating.AGE_13_PLUS],
}

export function allowedAgeRatings(ageGroup: string): AgeRating[] {
  return AGE_RATING_MAP[ageGroup] ?? Object.values(AgeRating)
}
