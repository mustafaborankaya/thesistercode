import { sizeGuideContent } from '../../data/content'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { usePanels } from '../../state/PanelContext'
import { ContentText } from '../ui/ContentText'
import { Drawer } from '../ui/Drawer'

/** Beden rehberi paneli — masaüstünde sağdan, mobilde alttan açılır. Ölçü tablosu uydurulmaz. */
export function SizeGuideDrawer() {
  const { isOpen, closePanel } = usePanels()
  const isDesktop = useIsDesktop()
  const open = isOpen('size-guide')

  return (
    <Drawer open={open} onClose={() => closePanel('size-guide')} title={sizeGuideContent.title} side={isDesktop ? 'right' : 'bottom'}>
      <div className="stack">
        <ContentText field={sizeGuideContent.table} />
        <ContentText field={sizeGuideContent.note} />
      </div>
    </Drawer>
  )
}
