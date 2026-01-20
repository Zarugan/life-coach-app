import { Agent, User, MealPlan, Recipe, Goal, NutritionalInfo } from '../types';
import { logger } from '../utils/logger';
import { getDatabase } from '../config/database';
import { getRedis } from '../config/redis';
import axios from 'axios';

export class DietitianAgent {
  private agent: Agent;
  private openai: any;

  constructor() {
    this.agent = {
      id: 'dietitian',
      type: 'dietitian',
      name: 'Dietitian',
      description: 'Provides nutrition advice, meal planning, and dietary guidance',
      capabilities: [
        'meal-planning',
        'nutrition-analysis',
        'recipe-recommendations',
        'dietary-restrictions',
        'grocery-list-optimization',
        'nutritional-tracking',
        'meal-prep-planning',
        'cost-optimization'
      ],
      status: 'active',
      config: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        systemPrompt: `You are a Registered Dietitian AI agent specializing in nutrition and meal planning.
        Your role is to:
        1. Create personalized meal plans based on dietary needs and goals
        2. Provide nutritional analysis and recommendations
        3. Suggest recipes that match preferences and restrictions
        4. Optimize grocery lists for cost and nutrition
        5. Coordinate with Financial Advisor for budget-conscious meal planning
        6. Track nutritional intake and progress towards goals
        
        Always provide evidence-based nutritional advice. Consider taste preferences, 
        cooking skill level, budget constraints, and time limitations. Be encouraging 
        and realistic about dietary changes.`,
        tools: []
      }
    };
  }

  async initialize(): Promise<void> {
    try {
      const { OpenAI } = await import('openai');
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      logger.info('Dietitian Agent initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Dietitian Agent:', error);
      throw error;
    }
  }

  async createMealPlan(userId: string, preferences: any): Promise<any> {
    try {
      logger.info(`Creating meal plan for user ${userId}`);

      // Get user profile and goals
      const userProfile = await this.getUserProfile(userId);
      const goals = await this.getUserGoals(userId, 'nutrition');
      
      // Generate meal plan using AI
      const mealPlanData = await this.generateMealPlan(
        userProfile,
        goals,
        preferences
      );
      
      // Get recipes for each meal
      const mealsWithRecipes = await this.getRecipesForMeals(mealPlanData.meals);
      
      // Calculate nutritional information
      const nutritionalInfo = await this.calculateNutritionalInfo(mealsWithRecipes);
      
      // Store meal plan
      const mealPlan = await this.storeMealPlan(userId, {
        ...mealPlanData,
        meals: mealsWithRecipes,
        nutritionalInfo
      });
      
      // Generate grocery list
      const groceryList = await this.generateGroceryList(mealsWithRecipes);
      
      // Get cost optimization insights
      const costOptimization = await this.optimizeCosts(userId, groceryList);
      
      return {
        success: true,
        mealPlan,
        groceryList,
        costOptimization,
        nutritionalSummary: nutritionalInfo,
        prepInstructions: await this.generatePrepInstructions(mealsWithRecipes),
        crossAgentInsights: await this.getCrossAgentInsights(mealPlan, groceryList)
      };

    } catch (error) {
      logger.error('Error creating meal plan:', error);
      throw error;
    }
  }

  async searchRecipes(userId: string, query: string, filters: any = {}): Promise<any> {
    try {
      // Get user preferences and restrictions
      const userProfile = await this.getUserProfile(userId);
      
      // Search for recipes using AI and external APIs
      const recipes = await this.findRecipes(
        query,
        filters,
        userProfile.dietaryRestrictions || []
      );
      
      // Rate recipes based on user preferences
      const ratedRecipes = await this.rateRecipes(recipes, userProfile);
      
      return {
        success: true,
        recipes: ratedRecipes,
        total: recipes.length,
        suggestions: await this.generateRecipeSuggestions(userId, query)
      };

    } catch (error) {
      logger.error('Error searching recipes:', error);
      throw error;
    }
  }

  async analyzeNutrition(userId: string, meals: any[]): Promise<any> {
    try {
      // Calculate nutritional information for meals
      const nutritionalAnalysis = await this.calculateMealNutrition(meals);
      
      // Compare to nutritional goals
      const goalsComparison = await this.compareToGoals(userId, nutritionalAnalysis);
      
      // Generate recommendations
      const recommendations = await this.generateNutritionalRecommendations(
        userId,
        nutritionalAnalysis,
        goalsComparison
      );
      
      return {
        success: true,
        analysis: nutritionalAnalysis,
        goalsComparison,
        recommendations,
        dailySummary: await this.generateDailySummary(nutritionalAnalysis),
        weeklyTrends: await this.getWeeklyNutritionTrends(userId)
      };

    } catch (error) {
      logger.error('Error analyzing nutrition:', error);
      throw error;
    }
  }

  async optimizeGroceryList(userId: string, items: any[], budget?: number): Promise<any> {
    try {
      // Get user location and preferences
      const userProfile = await this.getUserProfile(userId);
      
      // Find best stores and prices
      const storeAnalysis = await this.findBestStores(items, userProfile.location);
      
      // Optimize for cost and nutrition
      const optimizedList = await this.optimizeGroceryItems(
        items,
        storeAnalysis,
        budget
      );
      
      // Generate alternatives for expensive items
      const alternatives = await this.findCostAlternatives(optimizedList);
      
      return {
        success: true,
        optimizedList,
        storeAnalysis,
        alternatives,
        totalCost: optimizedList.reduce((sum, item) => sum + item.cost, 0),
        savings: await this.calculateSavings(items, optimizedList),
        nutritionalValue: await this.calculateGroceryNutrition(optimizedList)
      };

    } catch (error) {
      logger.error('Error optimizing grocery list:', error);
      throw error;
    }
  }

  async trackNutritionalIntake(userId: string, date: string, meals: any[]): Promise<any> {
    try {
      // Calculate daily nutritional intake
      const dailyIntake = await this.calculateDailyIntake(meals);
      
      // Compare to recommended daily values
      const rdvComparison = await this.compareToRDV(dailyIntake);
      
      // Track progress towards goals
      const goalProgress = await this.trackNutritionalGoals(userId, dailyIntake);
      
      // Store tracking data
      await this.storeNutritionalTracking(userId, date, dailyIntake);
      
      return {
        success: true,
        date,
        dailyIntake,
        rdvComparison,
        goalProgress,
        insights: await this.generateNutritionalInsights(userId, dailyIntake),
        recommendations: await this.generateDailyRecommendations(dailyIntake, rdvComparison)
      };

    } catch (error) {
      logger.error('Error tracking nutritional intake:', error);
      throw error;
    }
  }

  private async generateMealPlan(
    userProfile: any,
    goals: any[],
    preferences: any
  ): Promise<any> {
    try {
      const prompt = `
        Create a comprehensive 7-day meal plan based on:
        - User Profile: ${JSON.stringify(userProfile)}
        - Goals: ${JSON.stringify(goals)}
        - Preferences: ${JSON.stringify(preferences)}
        
        Consider:
        - Dietary restrictions and allergies
        - Caloric needs based on activity level and goals
        - Macronutrient balance (protein, carbs, fats)
        - Meal timing and frequency
        - Cooking skill level
        - Time constraints
        - Budget considerations
        
        Return JSON with:
        - name: Meal plan name
        - duration: 7 days
        - meals: Array of meals for each day
        - nutritionalTargets: Daily nutritional goals
        - prepNotes: Meal preparation guidance
        
        Each meal should include:
        - day: Day of week
        - type: breakfast/lunch/dinner/snack
        - name: Meal name
        - estimatedTime: Cooking time
        - difficulty: easy/medium/hard
        - cost: Estimated cost
        
        Only return valid JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: this.agent.config.model,
        messages: [
          { role: 'system', content: 'You are a registered dietitian. Create evidence-based, personalized meal plans.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        maxTokens: 2000
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating meal plan:', error);
      throw error;
    }
  }

  private async getRecipesForMeals(meals: any[]): Promise<any[]> {
    try {
      const mealsWithRecipes = [];
      
      for (const meal of meals) {
        const recipe = await this.findRecipeForMeal(meal);
        mealsWithRecipes.push({
          ...meal,
          recipe
        });
      }
      
      return mealsWithRecipes;
    } catch (error) {
      logger.error('Error getting recipes for meals:', error);
      throw error;
    }
  }

  private async findRecipeForMeal(meal: any): Promise<Recipe> {
    try {
      // Search for recipe based on meal name and requirements
      const query = `${meal.name} recipe healthy`;
      const recipes = await this.searchExternalRecipes(query, {
        dietaryRestrictions: meal.dietaryRestrictions || [],
        maxTime: meal.estimatedTime || 30,
        difficulty: meal.difficulty || 'medium'
      });

      // Select best matching recipe
      const bestRecipe = recipes[0] || await this.generateFallbackRecipe(meal);
      
      return {
        id: this.generateId(),
        name: bestRecipe.name,
        description: bestRecipe.description,
        ingredients: bestRecipe.ingredients,
        instructions: bestRecipe.instructions,
        prepTime: bestRecipe.prepTime || 10,
        cookTime: bestRecipe.cookTime || meal.estimatedTime || 20,
        servings: bestRecipe.servings || 2,
        difficulty: meal.difficulty || 'medium',
        nutritionalInfo: bestRecipe.nutritionalInfo || {},
        dietaryRestrictions: meal.dietaryRestrictions || [],
        cost: meal.cost || 0
      };
    } catch (error) {
      logger.error('Error finding recipe for meal:', error);
      throw error;
    }
  }

  private async searchExternalRecipes(query: string, filters: any): Promise<any[]> {
    try {
      // In production, would integrate with recipe APIs like:
      // - Spoonacular
      // - Edamam
      // - Yummly
      
      // For now, generate recipes using AI
      return await this.generateRecipes(query, filters);
    } catch (error) {
      logger.error('Error searching external recipes:', error);
      return [];
    }
  }

  private async generateRecipes(query: string, filters: any): Promise<any[]> {
    try {
      const prompt = `
        Generate 3 healthy recipes for: ${query}
        
        Filters: ${JSON.stringify(filters)}
        
        For each recipe, provide:
        - name: Recipe name
        - description: Brief description
        - ingredients: Array with name, quantity, unit
        - instructions: Step-by-step cooking instructions
        - prepTime: Preparation time in minutes
        - cookTime: Cooking time in minutes
        - servings: Number of servings
        - nutritionalInfo: Calories, protein, carbs, fat
        - cost: Estimated cost in USD
        
        Return JSON array of recipes.
        Only return valid JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: this.agent.config.model,
        messages: [
          { role: 'system', content: 'You are a professional chef. Create detailed, tested recipes.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        maxTokens: 1500
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating recipes:', error);
      return [];
    }
  }

  private async generateFallbackRecipe(meal: any): Promise<any> {
    return {
      name: meal.name,
      description: `Healthy ${meal.name} recipe`,
      ingredients: [],
      instructions: ['Cook according to preferences'],
      prepTime: 10,
      cookTime: meal.estimatedTime || 20,
      servings: 2,
      nutritionalInfo: { calories: 400, protein: 25, carbs: 40, fat: 15 },
      cost: meal.cost || 10
    };
  }

  private async calculateNutritionalInfo(meals: any[]): Promise<NutritionalInfo> {
    try {
      const totalNutrition = meals.reduce((acc, meal) => {
        const nutrition = meal.recipe?.nutritionalInfo || {};
        return {
          calories: acc.calories + (nutrition.calories || 0),
          protein: acc.protein + (nutrition.protein || 0),
          carbohydrates: acc.carbohydrates + (nutrition.carbohydrates || 0),
          fat: acc.fat + (nutrition.fat || 0),
          fiber: acc.fiber + (nutrition.fiber || 0),
          sugar: acc.sugar + (nutrition.sugar || 0),
          sodium: acc.sodium + (nutrition.sodium || 0)
        };
      }, {
        calories: 0,
        protein: 0,
        carbohydrates: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0
      });

      return totalNutrition;
    } catch (error) {
      logger.error('Error calculating nutritional info:', error);
      throw error;
    }
  }

  private async storeMealPlan(userId: string, mealPlanData: any): Promise<MealPlan> {
    try {
      const db = getDatabase();
      
      const mealPlan: MealPlan = {
        id: this.generateId(),
        userId,
        name: mealPlanData.name,
        duration: mealPlanData.duration,
        meals: mealPlanData.meals,
        nutritionalInfo: mealPlanData.nutritionalInfo,
        createdAt: new Date()
      };

      await db.query(
        `INSERT INTO meal_plans (id, user_id, name, duration, meals, nutritional_info, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          mealPlan.id,
          mealPlan.userId,
          mealPlan.name,
          mealPlan.duration,
          JSON.stringify(mealPlan.meals),
          JSON.stringify(mealPlan.nutritionalInfo),
          mealPlan.createdAt
        ]
      );

      return mealPlan;
    } catch (error) {
      logger.error('Error storing meal plan:', error);
      throw error;
    }
  }

  private async generateGroceryList(meals: any[]): Promise<any[]> {
    try {
      const ingredientMap = new Map();
      
      // Aggregate all ingredients from meals
      for (const meal of meals) {
        if (meal.recipe && meal.recipe.ingredients) {
          for (const ingredient of meal.recipe.ingredients) {
            const key = `${ingredient.name.toLowerCase()}`;
            const existing = ingredientMap.get(key) || {
              name: ingredient.name,
              quantity: 0,
              unit: ingredient.unit,
              category: this.categorizeIngredient(ingredient.name)
            };
            
            // Add quantities (simplified - would need proper unit conversion)
            existing.quantity += ingredient.quantity;
            ingredientMap.set(key, existing);
          }
        }
      }
      
      return Array.from(ingredientMap.values());
    } catch (error) {
      logger.error('Error generating grocery list:', error);
      return [];
    }
  }

  private categorizeIngredient(ingredientName: string): string {
    const categories = {
      'produce': ['apple', 'banana', 'carrot', 'lettuce', 'tomato', 'onion', 'garlic'],
      'protein': ['chicken', 'beef', 'fish', 'eggs', 'tofu', 'beans'],
      'dairy': ['milk', 'cheese', 'yogurt', 'butter'],
      'grains': ['rice', 'pasta', 'bread', 'oats'],
      'pantry': ['oil', 'salt', 'pepper', 'spices', 'sauce']
    };

    const name = ingredientName.toLowerCase();
    for (const [category, items] of Object.entries(categories)) {
      if (items.some(item => name.includes(item))) {
        return category;
      }
    }
    
    return 'other';
  }

  private async getUserProfile(userId: string): Promise<any> {
    try {
      const db = getDatabase();
      const result = await db.query(
        'SELECT preferences FROM users WHERE id = $1',
        [userId]
      );
      
      return result.rows[0]?.preferences || {};
    } catch (error) {
      logger.error('Error getting user profile:', error);
      return {};
    }
  }

  private async getUserGoals(userId: string, category: string): Promise<any[]> {
    try {
      const db = getDatabase();
      const result = await db.query(
        'SELECT * FROM goals WHERE user_id = $1 AND category = $2 AND status = $3',
        [userId, category, 'active']
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting user goals:', error);
      return [];
    }
  }

  private async getCrossAgentInsights(mealPlan: any, groceryList: any[]): Promise<any[]> {
    const insights = [];

    // Financial advisor insights
    insights.push({
      agent: 'financial-advisor',
      type: 'cost-optimization',
      message: 'Meal plan created. Can optimize grocery costs and find best deals.',
      data: {
        estimatedGroceryCost: groceryList.reduce((sum, item) => sum + (item.cost || 0), 0),
        mealCount: mealPlan.meals.length,
        costPerMeal: 0
      }
    });

    return insights;
  }

  private async optimizeCosts(userId: string, groceryList: any[]): Promise<any> {
    try {
      // Find cost-saving opportunities
      const optimizations = [];
      
      for (const item of groceryList) {
        // Find cheaper alternatives
        const alternatives = await this.findCheaperAlternatives(item);
        if (alternatives.length > 0) {
          optimizations.push({
            item: item.name,
            currentCost: item.cost || 0,
            alternatives,
            potentialSavings: alternatives[0].cost - (item.cost || 0)
          });
        }
      }
      
      return {
        optimizations,
        totalPotentialSavings: optimizations.reduce((sum, opt) => sum + opt.potentialSavings, 0)
      };
    } catch (error) {
      logger.error('Error optimizing costs:', error);
      return { optimizations: [], totalPotentialSavings: 0 };
    }
  }

  private async findCheaperAlternatives(item: any): Promise<any[]> {
    try {
      // In production, would integrate with grocery APIs
      // For now, return placeholder alternatives
      return [
        {
          name: `${item.name} (store brand)`,
          cost: (item.cost || 0) * 0.7,
          store: 'Store Brand'
        }
      ];
    } catch (error) {
      logger.error('Error finding cheaper alternatives:', error);
      return [];
    }
  }

  private async generatePrepInstructions(meals: any[]): Promise<any> {
    try {
      const prompt = `
        Generate meal prep instructions for these meals:
        ${JSON.stringify(meals.map(m => ({ name: m.name, type: m.type, recipe: m.recipe?.name })))}
        
        Provide:
        - weekendPrep: Tasks for weekend meal prep
        - dailyTasks: Daily tasks for the week
        - storageInstructions: How to store prepped items
        - timeline: Suggested prep timeline
        
        Return JSON with detailed prep instructions.
        Only return valid JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: this.agent.config.model,
        messages: [
          { role: 'system', content: 'You are a meal prep expert. Create efficient prep instructions.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        maxTokens: 1500
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating prep instructions:', error);
      return {};
    }
  }

  private async findBestStores(items: any[], location?: any): Promise<any> {
    try {
      // In production, would integrate with grocery store APIs
      // For now, return placeholder store analysis
      return {
        recommendedStore: 'Local Supermarket',
        alternatives: ['Whole Foods', 'Trader Joe\'s'],
        totalCost: items.reduce((sum, item) => sum + (item.cost || 0), 0),
        savings: 0
      };
    } catch (error) {
      logger.error('Error finding best stores:', error);
      return {};
    }
  }

  private async optimizeGroceryItems(items: any[], storeAnalysis: any, budget?: number): Promise<any[]> {
    try {
      // Return optimized items with cost information
      return items.map(item => ({
        ...item,
        cost: item.cost || 5,
        store: storeAnalysis.recommendedStore,
        inSeason: this.isInSeason(item.name),
        organicOption: item.name + ' (organic)'
      }));
    } catch (error) {
      logger.error('Error optimizing grocery items:', error);
      return items;
    }
  }

  private isInSeason(itemName: string): boolean {
    // Simplified seasonality check
    const currentMonth = new Date().getMonth();
    const seasonalProduce = {
      0: ['squash', 'citrus', 'kale'], // January
      1: ['squash', 'citrus', 'kale'], // February
      2: ['asparagus', 'spinach', 'strawberries'], // March
      3: ['asparagus', 'spinach', 'strawberries'], // April
      4: ['berries', 'zucchini', 'tomatoes'], // May
      5: ['berries', 'zucchini', 'tomatoes'], // June
      6: ['watermelon', 'peaches', 'cucumber'], // July
      7: ['watermelon', 'peaches', 'cucumber'], // August
      8: ['apples', 'pumpkin', 'grapes'], // September
      9: ['apples', 'pumpkin', 'grapes'], // October
      10: ['squash', 'apples', 'brussels'], // November
      11: ['squash', 'apples', 'brussels'] // December
    };

    const monthProduce = seasonalProduce[currentMonth] || [];
    return monthProduce.some(produce => itemName.toLowerCase().includes(produce));
  }

  private async findCostAlternatives(items: any[]): Promise<any[]> {
    try {
      // Find cost-effective alternatives for expensive items
      return items
        .filter(item => (item.cost || 0) > 10)
        .map(item => ({
          originalItem: item.name,
          originalCost: item.cost,
          alternatives: [
            {
              name: `${item.name} (frozen)`,
              cost: (item.cost || 0) * 0.6,
              savings: (item.cost || 0) * 0.4
            }
          ]
        }));
    } catch (error) {
      logger.error('Error finding cost alternatives:', error);
      return [];
    }
  }

  private async calculateSavings(originalItems: any[], optimizedItems: any[]): Promise<number> {
    const originalCost = originalItems.reduce((sum, item) => sum + (item.cost || 0), 0);
    const optimizedCost = optimizedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
    return originalCost - optimizedCost;
  }

  private async calculateGroceryNutrition(items: any[]): Promise<NutritionalInfo> {
    // Simplified nutritional calculation for grocery items
    return {
      calories: 0,
      protein: 0,
      carbohydrates: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0
    };
  }

  private async rateRecipes(recipes: any[], userProfile: any): Promise<any[]> {
    // Rate recipes based on user preferences
    return recipes.map(recipe => ({
      ...recipe,
      rating: Math.random() * 2 + 3, // Random rating between 3-5
      matchScore: this.calculateRecipeMatch(recipe, userProfile)
    }));
  }

  private calculateRecipeMatch(recipe: any, userProfile: any): number {
    // Calculate how well recipe matches user preferences
    return Math.random(); // Placeholder
  }

  private async generateRecipeSuggestions(userId: string, query: string): Promise<any[]> {
    try {
      const prompt = `
        Suggest 3 recipe search variations for: ${query}
        
        Provide suggestions that might yield better results based on common cooking terms.
        
        Return JSON array of suggested search terms.
        Only return valid JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: this.agent.config.model,
        messages: [
          { role: 'system', content: 'You are a recipe search expert. Suggest alternative search terms.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        maxTokens: 200
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating recipe suggestions:', error);
      return [];
    }
  }

  private async calculateMealNutrition(meals: any[]): Promise<any> {
    // Calculate nutritional information for provided meals
    return {
      totalCalories: meals.reduce((sum, meal) => sum + (meal.calories || 0), 0),
      macronutrients: {},
      micronutrients: {}
    };
  }

  private async compareTogoals(userId: string, nutrition: any): Promise<any> {
    // Compare nutritional intake to user's goals
    return {
      onTrack: [],
      needsImprovement: [],
      exceeding: []
    };
  }

  private async generateNutritionalRecommendations(
    userId: string,
    analysis: any,
    goalsComparison: any
  ): Promise<any[]> {
    return [
      {
        type: 'increase-protein',
        message: 'Consider adding more protein to your meals',
        priority: 'medium'
      }
    ];
  }

  private async generateDailySummary(nutrition: any): Promise<any> {
    return {
      totalCalories: nutrition.totalCalories,
      goalsMet: [],
      improvements: []
    };
  }

  private async getWeeklyNutritionTrends(userId: string): Promise<any> {
    return {
      trends: [],
      patterns: [],
      recommendations: []
    };
  }

  private async calculateDailyIntake(meals: any[]): Promise<any> {
    return this.calculateMealNutrition(meals);
  }

  private async compareTtoRDV(intake: any): Promise<any> {
    return {
      calories: { percentage: 100, status: 'on-track' },
      protein: { percentage: 80, status: 'below' },
      vitamins: {}
    };
  }

  private async trackNutritionalGoals(userId: string, intake: any): Promise<any> {
    return {
      goalsProgress: [],
      achievements: [],
      setbacks: []
    };
  }

  private async storeNutritionalTracking(userId: string, date: string, intake: any): Promise<void> {
    try {
      const db = getDatabase();
      await db.query(
        `INSERT INTO nutritional_tracking (user_id, date, intake_data, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [userId, date, JSON.stringify(intake)]
      );
    } catch (error) {
      logger.error('Error storing nutritional tracking:', error);
    }
  }

  private async generateNutritionalInsights(userId: string, intake: any): Promise<any[]> {
    return [
      {
        type: 'hydration',
        message: 'Remember to drink enough water throughout the day',
        priority: 'low'
      }
    ];
  }

  private async generateDailyRecommendations(intake: any, rdv: any): Promise<any[]> {
    return [
      {
        type: 'snack',
        message: 'Consider a healthy snack in the afternoon',
        priority: 'low'
      }
    ];
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}