-- CreateTable
CREATE TABLE "RecipeReaction" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "stars" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeReaction_userId_liked_idx" ON "RecipeReaction"("userId", "liked");

-- CreateIndex
CREATE INDEX "RecipeReaction_recipeId_idx" ON "RecipeReaction"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeReaction_recipeId_userId_key" ON "RecipeReaction"("recipeId", "userId");

-- AddForeignKey
ALTER TABLE "RecipeReaction" ADD CONSTRAINT "RecipeReaction_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeReaction" ADD CONSTRAINT "RecipeReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

