// Íconos disponibles para portadas de destacadas y escenas de video.
// La IA elige entre estos nombres para ilustrar lo que dice la voz en cada escena.
import {
  Activity, AlarmClock, AlertTriangle, Apple, Award, BadgeCheck, BadgePercent, Baby, Banknote, Bed, Beer, Bell, Bike,
  BookOpen, Brain, Briefcase, Brush, Bus, Cake, Calculator, CalendarCheck, CalendarDays, Camera, Car, Carrot, Cat, Check,
  ChefHat, ClipboardList, Clock, Cloud, Code, Coffee, Coins, Cookie, CreditCard, Croissant, Crown, Database, Dog,
  DollarSign, Droplet, Dumbbell, Eye, Factory, FileText, Film, Fish, Flame, Flower2, Gamepad2, Gem, Gift, Globe,
  GraduationCap, Hammer, Hand, Handshake, Headphones, Heart, HeartPulse, Hospital, Hotel, Hourglass, House, IceCreamCone,
  Image, Info, Key, Laptop, Leaf, Lightbulb, Link, ListChecks, Lock, Mail, Map, MapPin, Medal, Megaphone, MessageCircle,
  Mic, Monitor, Moon, Mountain, Music, Newspaper, Package, Palette, PawPrint, Percent, Phone, PiggyBank, Pill, Pizza,
  Plane, Presentation, Puzzle, QrCode, Receipt, Recycle, Rocket, Salad, Sandwich, Scale, Scissors, School, Search, Share2,
  Shield, ShieldCheck, Shirt, ShoppingBag, ShoppingCart, Smartphone, Smile, Snowflake, Sofa, Soup, Sparkles, Sprout,
  Star, Stethoscope, Store, Sun, Tag, Target, ThumbsDown, ThumbsUp, Ticket, Timer, TreePine, TrendingUp, Trophy, Truck,
  Umbrella, UserRound, Users, UtensilsCrossed, Video, Wallet, Wifi, Wine, Wrench, X, Zap, type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  // Negocio y ventas
  alerta: AlertTriangle, premio: Award, verificado: BadgeCheck, descuento: BadgePercent, billete: Banknote, trabajo: Briefcase,
  calculadora: Calculator, monedas: Coins, dinero: DollarSign, fabrica: Factory, factura: Receipt, acuerdo: Handshake,
  presentacion: Presentation, porcentaje: Percent, ahorro: PiggyBank, billetera: Wallet, tarjeta: CreditCard, etiqueta: Tag,
  tienda: Store, compras: ShoppingBag, carrito: ShoppingCart, paquete: Package, envio: Truck, crecimiento: TrendingUp,
  meta: Target, trofeo: Trophy, medalla: Medal, corona: Crown, joya: Gem, cohete: Rocket, rapido: Zap, balanza: Scale,
  seguridad: ShieldCheck, escudo: Shield, llave: Key, candado: Lock, qr: QrCode, enlace: Link, compartir: Share2,
  // Comunicación y tecnología
  megafono: Megaphone, mensaje: MessageCircle, correo: Mail, telefono: Phone, celular: Smartphone, laptop: Laptop,
  pantalla: Monitor, wifi: Wifi, nube: Cloud, codigo: Code, datos: Database, campana: Bell, microfono: Mic, video: Video,
  imagen: Image, pelicula: Film, audifonos: Headphones, camara: Camera, musica: Music, noticias: Newspaper, documento: FileText,
  lista: ListChecks, tareas: ClipboardList, buscar: Search, mundo: Globe, info: Info, idea: Lightbulb, idea_cerebro: Brain,
  rompecabezas: Puzzle, juego: Gamepad2, libro: BookOpen, escuela: School, graduacion: GraduationCap,
  // Tiempo
  reloj: Clock, alarma: AlarmClock, temporizador: Timer, reloj_arena: Hourglass, calendario: CalendarDays, agenda: CalendarCheck,
  // Personas y emociones
  equipo: Users, persona: UserRound, bebe: Baby, mano: Hand, ojo: Eye, corazon: Heart, salud: HeartPulse, actividad: Activity,
  sonrisa: Smile, like: ThumbsUp, dislike: ThumbsDown, estrella: Star, brillo: Sparkles, regalo: Gift, check: Check, no: X,
  // Comida
  menu: UtensilsCrossed, chef: ChefHat, cafe: Coffee, pizza: Pizza, pastel: Cake, helado: IceCreamCone, galleta: Cookie,
  croissant: Croissant, sandwich: Sandwich, ensalada: Salad, sopa: Soup, pescado: Fish, manzana: Apple, zanahoria: Carrot,
  vino: Wine, cerveza: Beer,
  // Lugares, transporte y hogar
  casa: House, hotel: Hotel, hospital: Hospital, ubicacion: MapPin, mapa: Map, ticket: Ticket, auto: Car, avion: Plane,
  bus: Bus, bicicleta: Bike, cama: Bed, sofa: Sofa,
  // Salud, belleza y servicios
  doctor: Stethoscope, pastilla: Pill, gimnasio: Dumbbell, tijeras: Scissors, ropa: Shirt, pincel: Brush, paleta: Palette,
  herramienta: Wrench, martillo: Hammer,
  // Naturaleza y mascotas
  hoja: Leaf, flor: Flower2, arbol: TreePine, brote: Sprout, reciclaje: Recycle, gota: Droplet, fuego: Flame, sol: Sun,
  luna: Moon, nieve: Snowflake, paraguas: Umbrella, montana: Mountain, perro: Dog, gato: Cat, huella: PawPrint,
};

export const ICON_NAMES = Object.keys(ICONS);
