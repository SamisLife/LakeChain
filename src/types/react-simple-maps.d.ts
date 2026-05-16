declare module 'react-simple-maps' {
  import { ReactNode, SVGProps } from 'react'

  interface ComposableMapProps {
    projection?: string | ((width: number, height: number) => unknown)
    projectionConfig?: Record<string, unknown>
    width?: number
    height?: number
    style?: React.CSSProperties
    children?: ReactNode
  }

  interface GeographiesProps {
    geography: string | object
    children: (props: { geographies: GeoFeature[] }) => ReactNode
  }

  interface GeoFeature {
    rsmKey: string
    id: string
    [key: string]: unknown
  }

  interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: GeoFeature
    style?: {
      default?: SVGProps<SVGPathElement>
      hover?: SVGProps<SVGPathElement>
      pressed?: SVGProps<SVGPathElement>
    }
  }

  interface MarkerProps {
    coordinates: [number, number]
    children?: ReactNode
  }

  export const ComposableMap: React.FC<ComposableMapProps>
  export const Geographies: React.FC<GeographiesProps>
  export const Geography: React.FC<GeographyProps>
  export const Marker: React.FC<MarkerProps>
  export const ZoomableGroup: React.FC<{ children?: ReactNode; [key: string]: unknown }>
  export const Line: React.FC<{ from: [number, number]; to: [number, number]; [key: string]: unknown }>
}
