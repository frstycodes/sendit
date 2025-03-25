import { StoreApi, UseBoundStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

export const createSelector =
  <TStore extends Record<string, unknown>>(
    store: UseBoundStore<StoreApi<TStore>>,
  ) =>
  <TKey extends keyof TStore>(...keys: TKey[]) =>
    store(useShallow(getStoreMapByKeys(keys)))

const getStoreMapByKeys =
  <TStore extends Record<string, unknown>, TKey extends keyof TStore>(
    keys: TKey[],
  ) =>
  (state: TStore) => {
    if (keys.length === 0) return state
    const map = {} as { [K in TKey]: TStore[K] }
    for (const key of keys) {
      map[key] = state[key]
    }
    return map
  }
