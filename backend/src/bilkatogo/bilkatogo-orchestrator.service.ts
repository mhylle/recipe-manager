import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { BilkaToGoAuthService } from './bilkatogo-auth.service.js';
import { BilkaToGoSearchService } from './bilkatogo-search.service.js';
import { BilkaToGoCartService } from './bilkatogo-cart.service.js';
import { ShoppingListService } from '../shopping-list/shopping-list.service.js';
import type {
  BilkaToGoSendResult,
  BilkaToGoMatchedItem,
  BilkaToGoUnmatchedItem,
} from './interfaces/bilkatogo.interfaces.js';

const CART_URL = 'https://www.bilkatogo.dk/checkout/cart';
const DELAY_BETWEEN_CALLS_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const INGREDIENT_TRANSLATIONS: Record<string, string> = {
  // Produce
  'avocado': 'avocado',
  'lime': 'lime',
  'lemon': 'citron',
  'red onion': 'rødløg',
  'white onion': 'løg',
  'onion': 'løg',
  'garlic': 'hvidløg',
  'jalapeño': 'jalapeño',
  'roma tomato': 'tomat',
  'tomatoes': 'tomater',
  'fresh cilantro': 'frisk koriander',
  'fresh parsley': 'frisk persille',
  'fresh basil': 'frisk basilikum',
  'fresh thyme': 'frisk timian',
  'fresh rosemary': 'frisk rosmarin',
  'fresh ginger': 'frisk ingefær',
  'fresh dill': 'frisk dild',
  'thai basil': 'thai basilikum',
  'green cabbage': 'spidskål',
  'carrots': 'gulerødder',
  'carrot': 'gulerod',
  'celery': 'bladselleri',
  'potatoes': 'kartofler',
  'eggplant': 'aubergine',
  'zucchini': 'squash',
  'red bell pepper': 'rød peberfrugt',
  'pineapple': 'ananas',
  'strawberries': 'jordbær',
  'raspberries': 'hindbær',
  'redcurrants': 'ribs',
  'bean sprouts': 'bønnespirer',
  'spring onions': 'forårsløg',
  'shallots': 'skalotteløg',
  'radishes': 'radiser',
  'mushrooms': 'champignon',
  'button mushrooms': 'champignon',
  'fresh mushrooms': 'champignon',
  'pearl onions': 'perleløg',
  'tomatillos': 'tomatillo',
  'long beans': 'bønner',
  'green papaya': 'grøn papaya',
  'lemongrass': 'citrongræs',
  'galangal': 'galanga',
  'kaffir lime leaves': 'limeblade',
  'orange zest': 'appelsinskal',
  // Meat
  'chicken breast': 'kyllingebryst',
  'chicken thighs': 'kyllingelår',
  'whole chicken': 'hel kylling',
  'pork shoulder': 'svinebov',
  'pork belly': 'flæsk',
  'pork loin': 'svinemørbrad',
  'pork loin with rind': 'flæskesteg',
  'ground pork': 'hakket svinekød',
  'ground beef': 'hakket oksekød',
  'ground veal': 'hakket kalvekød',
  'beef chuck': 'oksebov',
  'beef sirloin': 'oksemørbrad',
  'veal shanks': 'kalveskank',
  'lardons': 'bacon i tern',
  'pancetta': 'pancetta',
  'cold roast beef': 'roastbeef',
  'cooked shrimp': 'rejer',
  'raw shrimp': 'rejer',
  'salmon fillets': 'laksefilet',
  'bacon': 'bacon',
  // Dairy
  'butter': 'smør',
  'whole milk': 'sødmælk',
  'heavy cream': 'piskefløde',
  'sour cream': 'creme fraiche',
  'eggs': 'æg',
  'egg yolks': 'æggeblommer',
  'cheddar cheese': 'cheddar ost',
  'parmigiano-reggiano': 'parmesan',
  'pecorino romano': 'pecorino',
  'gruyère cheese': 'gruyère ost',
  'oaxaca cheese': 'mozzarella',
  'mascarpone': 'mascarpone',
  'buttermilk': 'kærnemælk',
  'feta': 'feta',
  // Grains & Pasta
  'corn tortillas': 'tortilla',
  'lasagna sheets': 'lasagneplader',
  'arborio rice': 'risottoris',
  'jasmine rice': 'jasminris',
  'japanese rice': 'sushi ris',
  'rice stick noodles': 'risnudler',
  'ramen noodles': 'ramen nudler',
  'dark rye bread': 'rugbrød',
  'baguette': 'flute',
  'tostadas': 'tortilla chips',
  'breadcrumbs': 'rasp',
  'panko breadcrumbs': 'panko rasp',
  'gyoza wrappers': 'dej til dumplings',
  'spaghetti': 'spaghetti',
  'tonnarelli or spaghetti': 'spaghetti',
  // Canned
  'canned tomatoes': 'hakkede tomater',
  'tomato passata': 'tomatsauce',
  'tomato paste': 'tomatpuré',
  'canned hominy': 'majs',
  'coconut cream': 'kokosmælk',
  'coconut milk': 'kokosmælk',
  'chicken broth': 'hønsebouillon',
  'beef broth': 'oksebouillon',
  'dashi stock': 'dashifond',
  'sweetcorn': 'majs',
  'pickled herring': 'marinerede sild',
  // Spices
  'salt': 'salt',
  'black pepper': 'sort peber',
  'black peppercorns': 'peberkorn',
  'cumin': 'spidskommen',
  'dried oregano': 'oregano',
  'ground cardamom': 'kardemomme',
  'ground cloves': 'nelliker',
  'cinnamon stick': 'kanelstang',
  'bay leaves': 'laurbærblade',
  'nutmeg': 'muskatnød',
  'allspice': 'allehånde',
  'star anise': 'stjerneanis',
  'curry powder': 'karry',
  'garam masala': 'garam masala',
  'turmeric': 'gurkemeje',
  'whole cloves': 'nelliker',
  // Condiments
  'olive oil': 'olivenolie',
  'vegetable oil': 'rapsolie',
  'sesame oil': 'sesamolie',
  'soy sauce': 'sojasauce',
  'fish sauce': 'fiskesauce',
  'oyster sauce': 'østersauce',
  'light soy sauce': 'lys sojasauce',
  'dark soy sauce': 'mørk sojasauce',
  'tamarind puree': 'tamarind',
  'tamarind paste': 'tamarindpasta',
  'white vinegar': 'hvidvinseddike',
  'apple cider vinegar': 'æblecidereddike',
  'rice vinegar': 'riseddike',
  'chilli oil': 'chiliolie',
  'remoulade': 'remoulade',
  'mayonnaise': 'mayonnaise',
  'capers': 'kapers',
  'mirin': 'mirin',
  'sake': 'risvin',
  'honey': 'honning',
  'tonkatsu sauce': 'tonkatsusauce',
  'pickled ginger': 'syltet ingefær',
  'green curry paste': 'grøn karrypasta',
  'massaman curry paste': 'massaman karrypasta',
  // Baking
  'plain flour': 'hvedemel',
  'sugar': 'sukker',
  'brown sugar': 'brun farin',
  'palm sugar': 'palmesukker',
  'powdered sugar': 'flormelis',
  'demerara sugar': 'rørsukker',
  'cocoa powder': 'kakao',
  'baking powder': 'bagepulver',
  'baking soda': 'natron',
  'vanilla extract': 'vaniljeekstrakt',
  'vanilla pod': 'vaniljestang',
  'potato starch': 'kartoffelmel',
  'almonds': 'mandler',
  'peanuts': 'peanuts',
  'pumpkin seeds': 'græskarkerner',
  'sesame seeds': 'sesamfrø',
  'raisins': 'rosiner',
  'raspberry jam': 'hindbærmarmelade',
  'savoiardi ladyfingers': 'savoiardikiks',
  'mexican chocolate': 'mørk chokolade',
  // Beverages
  'dry white wine': 'hvidvin',
  'red wine': 'rødvin',
  'marsala wine': 'marsala',
  'orange juice': 'appelsinjuice',
  'espresso coffee': 'espresso',
  'sparkling water': 'danskvand',
  // Other
  'firm tofu': 'tofu',
  'nori sheets': 'nori tang',
  'dried shrimp': 'tørrede rejer',
  'roasted peanuts': 'ristede peanuts',
  'miso paste': 'misopasta',
  'white miso paste': 'hvid misopasta',
};

function translateToDanish(name: string): string {
  const lower = name.toLowerCase().trim();
  return INGREDIENT_TRANSLATIONS[lower] ?? name;
}

@Injectable()
export class BilkaToGoOrchestratorService {
  private readonly logger = new Logger(BilkaToGoOrchestratorService.name);

  constructor(
    private readonly authService: BilkaToGoAuthService,
    private readonly searchService: BilkaToGoSearchService,
    private readonly cartService: BilkaToGoCartService,
    private readonly shoppingListService: ShoppingListService,
  ) {}

  async sendToCart(
    shoppingListId: string,
    sessionId: string,
  ): Promise<BilkaToGoSendResult> {
    const cookies = this.authService.getSessionCookies(sessionId);
    if (!cookies) {
      throw new UnauthorizedException('BilkaToGo session expired or invalid');
    }

    const shoppingList =
      await this.shoppingListService.findById(shoppingListId);

    const matched: BilkaToGoMatchedItem[] = [];
    const unmatched: BilkaToGoUnmatchedItem[] = [];

    const uncheckedItems = shoppingList.items.filter((item) => !item.checked);

    for (let i = 0; i < uncheckedItems.length; i++) {
      const item = uncheckedItems[i];

      try {
        // Try Danish translation first, fall back to English
        const danishName = translateToDanish(item.name);
        let products = await this.searchService.searchProduct(danishName);

        if (products.length === 0 && danishName !== item.name) {
          products = await this.searchService.searchProduct(item.name);
        }

        if (products.length === 0) {
          unmatched.push({
            itemName: item.name,
            reason: 'No matching products found',
          });
          continue;
        }

        const product = products[0];
        await this.cartService.addItem(cookies, product.objectID, 1);

        matched.push({
          itemName: item.name,
          quantity: item.quantity,
          unit: item.unit,
          product,
        });

        if (i < uncheckedItems.length - 1) {
          await delay(DELAY_BETWEEN_CALLS_MS);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to process item "${item.name}": ${error instanceof Error ? error.message : String(error)}`,
        );
        unmatched.push({
          itemName: item.name,
          reason: `Error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    this.logger.log(
      `Sent to BilkaToGo: ${matched.length} matched, ${unmatched.length} unmatched`,
    );

    return {
      matched,
      unmatched,
      cartUrl: CART_URL,
    };
  }
}
