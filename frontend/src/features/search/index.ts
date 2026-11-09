// F05 – pencarian & filter menu kuliner
import { getAllMenuItems, getPoiById } from '@/features/poi';
import type { DishCategory, FoodType, MenuItem, Poi, PriceBucket, TasteTag } from '@/types/content';

export type MenuFilterOptions = {
  query?: string;
  tastes?: TasteTag[];
  type?: FoodType;
  dishCategory?: DishCategory;
  priceBucket?: PriceBucket;
  isHalalOnly?: boolean;
};

export type MenuItemWithPoi = MenuItem & {
  poi?: Poi;
};

/**
 * Filter dan cari item menu berdasarkan kriteria (rasa, jenis hidangan, tipe, halal, harga, dan nama).
 * Menyertakan referensi data POI (tenant) agar saat item menu diklik, UI bisa langsung bernavigasi ke tenant tersebut.
 */
export function filterMenuItems(options: MenuFilterOptions = {}): MenuItemWithPoi[] {
  const items = getAllMenuItems();

  return items
    .filter((item) => {
      // Filter teks pencarian (nama menu)
      if (options.query && options.query.trim() !== '') {
        const q = options.query.toLowerCase().trim();
        if (!item.name.toLowerCase().includes(q)) {
          return false;
        }
      }

      // Filter rasa (tastes) - cocok jika menu memiliki minimal salah satu rasa yang dipilih
      if (options.tastes && options.tastes.length > 0) {
        const hasMatchingTaste = options.tastes.some((t) => item.tasteTags.includes(t));
        if (!hasMatchingTaste) return false;
      }

      // Filter jenis kuliner (makanan / minuman / jajanan)
      if (options.type && item.type !== options.type) {
        return false;
      }

      // Filter kategori hidangan (nasi, mie, kopi, dll)
      if (options.dishCategory && item.dishCategory !== options.dishCategory) {
        return false;
      }

      // Filter rentang harga
      if (options.priceBucket && item.priceBucket !== options.priceBucket) {
        return false;
      }

      // Filter halal
      if (options.isHalalOnly && item.isHalal === false) {
        return false;
      }

      return true;
    })
    .map((item) => ({
      ...item,
      poi: getPoiById(item.poiId),
    }));
}
