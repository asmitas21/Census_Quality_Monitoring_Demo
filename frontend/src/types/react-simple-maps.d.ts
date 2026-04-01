declare module "react-simple-maps" {
  import { ComponentType, ReactNode, CSSProperties } from "react";

  interface ProjectionConfig {
    scale?: number;
    center?: [number, number];
    rotate?: [number, number, number];
  }

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: ReactNode;
  }

  interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    children?: ReactNode;
  }

  interface GeographiesProps {
    geography: string | object;
    children: (data: { geographies: GeographyItem[] }) => ReactNode;
  }

  interface GeographyItem {
    rsmKey: string;
    id: string;
    properties: Record<string, unknown>;
  }

  interface StyleState {
    outline?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    cursor?: string;
  }

  interface GeographyProps {
    geography: GeographyItem;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: {
      default?: StyleState;
      hover?: StyleState;
      pressed?: StyleState;
    };
    onMouseEnter?: (event: React.MouseEvent) => void;
    onMouseMove?: (event: React.MouseEvent) => void;
    onMouseLeave?: (event: React.MouseEvent) => void;
    onClick?: (event: React.MouseEvent) => void;
    key?: string;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
}
