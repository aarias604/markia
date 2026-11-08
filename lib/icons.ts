// Íconos disponibles para portadas de destacadas y escenas de video.
import {
  AlertTriangle, Award, BookOpen, Brain, Briefcase, CalendarDays, Camera, Check, Clock, Coffee, CreditCard,
  Dumbbell, Flame, Gift, Globe, Heart, Leaf, Lightbulb, Mail, MapPin, Megaphone, MessageCircle, Music, Package,
  Percent, PiggyBank, Phone, Rocket, Scissors, Search, ShieldCheck, ShoppingBag, Smartphone, Smile, Sparkles,
  Star, Store, Sun, Tag, Target, ThumbsUp, TrendingUp, Trophy, Truck, Users, UtensilsCrossed, Wallet, Wrench, X, Zap,
  Info, type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  alerta: AlertTriangle, premio: Award, libro: BookOpen, idea_cerebro: Brain, trabajo: Briefcase, calendario: CalendarDays,
  camara: Camera, check: Check, reloj: Clock, cafe: Coffee, tarjeta: CreditCard, gimnasio: Dumbbell, fuego: Flame,
  regalo: Gift, mundo: Globe, corazon: Heart, hoja: Leaf, idea: Lightbulb, correo: Mail, ubicacion: MapPin,
  megafono: Megaphone, mensaje: MessageCircle, musica: Music, paquete: Package, porcentaje: Percent, ahorro: PiggyBank,
  telefono: Phone, cohete: Rocket, tijeras: Scissors, buscar: Search, seguridad: ShieldCheck, compras: ShoppingBag,
  celular: Smartphone, sonrisa: Smile, brillo: Sparkles, estrella: Star, tienda: Store, sol: Sun, etiqueta: Tag,
  meta: Target, like: ThumbsUp, crecimiento: TrendingUp, trofeo: Trophy, envio: Truck, equipo: Users, menu: UtensilsCrossed,
  billetera: Wallet, herramienta: Wrench, no: X, rapido: Zap, info: Info,
};

export const ICON_NAMES = Object.keys(ICONS);
