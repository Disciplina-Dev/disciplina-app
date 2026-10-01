/**
 * Catalogue d'icônes de l'application — **Iconoir uniquement**.
 *
 * Toutes les icônes passent par ce module plutôt que d'être importées
 * directement depuis `iconoir-react`. Deux raisons :
 *  - les noms exposés ici sont stables et parlants côté métier, ce qui évite
 *    d'avoir à retrouver le bon nom Iconoir à chaque usage ;
 *  - un changement de jeu d'icônes ne touche qu'un seul fichier.
 *
 * Les icônes Iconoir sont dessinées sur une grille 24×24 avec un trait de
 * 1.5px ; `IconProps` ci-dessous conserve la même API que celle utilisée
 * jusqu'ici (`size`, `className`, `strokeWidth`).
 */
import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & {
  /** Côté de l'icône en pixels (défaut : 24). */
  width?: string | number
  height?: string | number
}

/** Type d'une icône du catalogue, pour la stocker dans une table de config. */
export type IconComponent = ForwardRefExoticComponent<
  Omit<SVGProps<SVGSVGElement>, 'ref'> & RefAttributes<SVGSVGElement>
>

export {
  // --- Navigation & structure ---
  Dashboard as IconDashboard,
  NavArrowDown as IconChevronDown,
  NavArrowUp as IconChevronUp,
  NavArrowLeft as IconChevronLeft,
  NavArrowRight as IconChevronRight,
  ArrowLeft as IconArrowLeft,
  ArrowRight as IconArrowRight,
  Menu as IconMenu,
  Xmark as IconClose,

  // --- Actions ---
  Plus as IconPlus,
  Check as IconCheck,
  DoubleCheck as IconCheckDouble,
  EditPencil as IconEdit,
  PageEdit as IconEditDocument,
  Trash as IconTrash,
  FloppyDisk as IconSave,
  Copy as IconCopy,
  Download as IconDownload,
  Upload as IconUpload,
  Refresh as IconRefresh,
  Repeat as IconRepeat,
  Undo as IconUndo,
  Search as IconSearch,
  Filter as IconFilter,
  FilterList as IconFilterList,
  Sort as IconSort,
  Send as IconSend,
  Attachment as IconAttachment,
  OpenNewWindow as IconExternalLink,
  Link as IconLink,
  Eye as IconEye,
  EyeClosed as IconEyeOff,
  Camera as IconCamera,
  Drag as IconDrag,
  Prohibition as IconForbidden,
  Minus as IconMinus,
  Circle as IconCircle,
  CheckSquare as IconCheckbox,
  QrCode as IconQrCode,
  ShareAndroid as IconShare,
  ControlSlider as IconSliders,
  HelpCircle as IconHelp,
  LinkSlash as IconUnlink,
  Bug as IconBug,

  // --- Statuts & retours ---
  CheckCircle as IconCheckCircle,
  XmarkCircle as IconErrorCircle,
  WarningTriangle as IconWarning,
  WarningCircle as IconAlert,
  InfoCircle as IconInfo,
  Sparks as IconSparkles,

  // --- Entités métier ---
  Building as IconCompany,
  Bank as IconInstitution,
  Suitcase as IconJob,
  User as IconUser,
  Group as IconUsers,
  UserPlus as IconUserPlus,
  UserBadgeCheck as IconUserCheck,
  UserXmark as IconUserRemove,
  ProfileCircle as IconProfile,
  GraduationCap as IconTraining,
  Handbag as IconPortfolio,
  Heart as IconFavorite,

  // --- Documents & dossiers ---
  Page as IconFile,
  EmptyPage as IconFileEmpty,
  MultiplePages as IconFiles,
  FileNotFound as IconFileMissing,
  Folder as IconFolder,
  FolderPlus as IconFolderPlus,
  FolderSettings as IconFolderSettings,
  FolderWarning as IconFolderWarning,
  ClipboardCheck as IconClipboardCheck,
  TaskList as IconTaskList,
  List as IconList,

  // --- Communication ---
  Mail as IconMail,
  MailOpen as IconMailOpen,
  Message as IconMessage,
  Phone as IconPhone,
  Megaphone as IconAnnounce,
  Bell as IconBell,
  BellNotification as IconBellActive,
  BellOff as IconBellOff,

  // --- Temps ---
  Calendar as IconCalendar,
  CalendarPlus as IconCalendarPlus,
  Clock as IconClock,
  Timer as IconSchedule,
  RefreshDouble as IconLoader,
  ClockRotateRight as IconHistory,

  // --- Sécurité & accès ---
  Shield as IconShield,
  ShieldCheck as IconShieldCheck,
  ShieldAlert as IconShieldAlert,
  ShieldXmark as IconShieldOff,
  Lock as IconLock,
  Key as IconKey,
  LogIn as IconLogin,
  LogOut as IconLogout,

  // --- Données & pilotage ---
  StatsReport as IconReport,
  GraphUp as IconTrendUp,
  GraphDown as IconTrendDown,
  StatsUpSquare as IconChart,
  Table as IconSpreadsheet,
  Reports as IconReports,

  // --- Divers ---
  Settings as IconSettings,
  Tools as IconTools,
  Globe as IconGlobe,
  MapPin as IconMapPin,
  Hashtag as IconHash,
  Play as IconPlay,
  Flower as IconFlower,
  Car as IconCar,
  Label as IconTag,
  TriangleFlag as IconGoal,
  MediaVideo as IconVideo,
  MediaImage as IconImage,
  MediaImagePlus as IconImagePlus,
  SubmitDocument as IconSignature,
  SendMail as IconMailSent,
  NumberedListLeft as IconListOrdered,

  // --- Éditeur de texte riche ---
  Text as IconHeading,
  Bold as IconBold,
  Italic as IconItalic,
  Underline as IconUnderline,
  AlignLeft as IconAlignLeft,
  AlignCenter as IconAlignCenter,
  AlignRight as IconAlignRight,
  Palette as IconPalette,
  TextSize as IconTextSize,
  FillColorSolid as IconHighlight,
  CursorPointer as IconCursorClick,
} from 'iconoir-react'
