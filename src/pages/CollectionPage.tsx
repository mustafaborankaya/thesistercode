import { useParams } from 'react-router-dom'
import { CollectionView } from '../components/collection/CollectionView'
import type { CategoryId } from '../data/types'
import { isCategoryId } from '../lib/catalog'
import { NotFoundPage } from './NotFoundPage'

export function CollectionPage() {
  const { categoryId } = useParams<{ categoryId?: string }>()

  if (categoryId && !isCategoryId(categoryId)) {
    return <NotFoundPage />
  }

  return <CollectionView categoryId={(categoryId as CategoryId | undefined) ?? 'tum-urunler'} />
}
