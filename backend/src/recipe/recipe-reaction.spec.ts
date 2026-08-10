import {
  normaliseStars,
  summariseReactions,
  type ReactionRow,
} from './recipe-reaction';

const row = (over: Partial<ReactionRow> = {}): ReactionRow => ({
  recipeId: 'r1',
  userId: 'u-other',
  liked: false,
  stars: null,
  ...over,
});

describe('summariseReactions', () => {
  it('counts the likes', () => {
    const summary = summariseReactions([
      row({ userId: 'u1', liked: true }),
      row({ userId: 'u2', liked: true }),
      row({ userId: 'u3', liked: false }),
    ]).get('r1')!;

    expect(summary.likeCount).toBe(2);
  });

  it('averages only the rows that carry a score', () => {
    // The distractor is the liked-but-unrated row: counting it as a zero would
    // drag a 5-star recipe down to 2.5 for the crime of being liked.
    const summary = summariseReactions([
      row({ userId: 'u1', stars: 5 }),
      row({ userId: 'u2', liked: true }),
    ]).get('r1')!;

    expect(summary.ratingCount).toBe(1);
    expect(summary.ratingAverage).toBe(5);
  });

  it('leaves the average null when nobody has rated it', () => {
    // Null, never 0: rendering "0 stars" for an unrated dish tells every reader
    // it was judged and found terrible.
    const summary = summariseReactions([row({ liked: true })]).get('r1')!;

    expect(summary.ratingAverage).toBeNull();
    expect(summary.ratingCount).toBe(0);
  });

  it('rounds the average to one decimal', () => {
    const summary = summariseReactions([
      row({ userId: 'u1', stars: 4 }),
      row({ userId: 'u2', stars: 5 }),
      row({ userId: 'u3', stars: 4 }),
    ]).get('r1')!;

    // 13/3 = 4.333..., which must not reach a client as 4.333333333333333.
    expect(summary.ratingAverage).toBe(4.3);
  });

  it("reports the viewer's own like and score", () => {
    const summary = summariseReactions(
      [
        row({ userId: 'u-me', liked: true, stars: 3 }),
        row({ userId: 'u-other', liked: true, stars: 5 }),
      ],
      'u-me',
    ).get('r1')!;

    expect(summary.likedByMe).toBe(true);
    expect(summary.myStars).toBe(3);
    // Their own row still counts towards the public totals.
    expect(summary.likeCount).toBe(2);
    expect(summary.ratingAverage).toBe(4);
  });

  it('claims nothing as the viewer’s when nobody is signed in', () => {
    const summary = summariseReactions([
      row({ userId: 'u-other', liked: true, stars: 5 }),
    ]).get('r1')!;

    expect(summary.likedByMe).toBe(false);
    expect(summary.myStars).toBeNull();
  });

  it('keeps each recipe’s totals to itself', () => {
    const byRecipe = summariseReactions([
      row({ recipeId: 'r1', userId: 'u1', stars: 5 }),
      row({ recipeId: 'r2', userId: 'u1', stars: 1 }),
    ]);

    expect(byRecipe.get('r1')!.ratingAverage).toBe(5);
    expect(byRecipe.get('r2')!.ratingAverage).toBe(1);
  });

  it('has nothing to say about a recipe with no rows', () => {
    expect(summariseReactions([]).get('r1')).toBeUndefined();
  });
});

describe('normaliseStars', () => {
  it('keeps a score on the scale', () => {
    expect(normaliseStars(1)).toBe(1);
    expect(normaliseStars(5)).toBe(5);
  });

  it('reads 0 as clearing the score', () => {
    // Null, not a deletion: the row also holds the like.
    expect(normaliseStars(0)).toBeNull();
  });

  it('refuses a score off the scale', () => {
    expect(() => normaliseStars(6)).toThrow(RangeError);
    expect(() => normaliseStars(-1)).toThrow(RangeError);
  });

  it('refuses half stars', () => {
    expect(() => normaliseStars(3.5)).toThrow(RangeError);
  });
});
