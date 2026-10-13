export interface PlaybookCase {
  artist: string;
  release: string;
  what: string;
  lesson: string;
  apply: string[];
}

export const PLAYBOOK: PlaybookCase[] = [
  {
    artist: "Lil Nas X",
    release: "Old Town Road",
    what: "Movió el tema con memes antes que con prensa. En TikTok se volvió el soundtrack del Yeehaw Challenge. Cuando lo sacaron del chart country de Billboard, la polémica le sumó conversación, y el remix con Billy Ray Cyrus le abrió otra audiencia.",
    lesson: "El tema tiene que poder usarse como meme. Un remix con alguien de otro público multiplica más que otra ronda de posteos.",
    apply: [
      "Identificar los 8 segundos que funcionan solos, sin contexto.",
      "Armar un challenge que se pueda hacer sin saber bailar.",
      "Planear el remix antes del release, no cuando el tema ya se enfrió.",
    ],
  },
  {
    artist: "Rosalía",
    release: "El Mal Querer / MOTOMAMI",
    what: "Trató cada álbum como una obra con concepto: en El Mal Querer cada single era un capítulo. Para MOTOMAMI presentó el disco con una performance pensada para TikTok y en formato vertical.",
    lesson: "Un concepto fuerte hace que cada pieza sume a la misma historia. Y si una plataforma tiene su formato, se lo usa en serio, no se adapta lo de siempre.",
    apply: [
      "Darle a cada release un concepto de una línea y bajarlo a todas las piezas.",
      "Pensar al menos una pieza nativa del formato vertical, no un recorte del videoclip.",
      "Mantener la paleta y la tipografía del sello en todo el ciclo.",
    ],
  },
  {
    artist: "Lola Índigo",
    release: "Ya no quiero ná",
    what: "Salió de Operación Triunfo y construyó su identidad alrededor del baile. La coreografía es parte del tema, y eso hace que el público pueda replicarlo.",
    lesson: "Si el artista tiene una firma reconocible (un paso, un gesto, una estética), el contenido del público se arma solo.",
    apply: [
      "Definir la firma del artista: un gesto, un paso, una frase.",
      "Que aparezca en todas las piezas del batch.",
      "Repostear a los fans que la usan, eso alimenta el loop.",
    ],
  },
  {
    artist: "Benson Boone",
    release: "Beautiful Things",
    what: "Fue mostrando fragmentos del tema en TikTok durante meses antes de sacarlo. Cuando salió, ya había gente esperándolo.",
    lesson: "Los snippets sirven para testear y para acumular demanda. Salir cuando la demanda ya está probada baja el riesgo.",
    apply: [
      "Subir 2 o 3 snippets distintos del mismo tema y comparar views y comentarios.",
      "Usar el que mejor rinda como hook del release.",
      "Contar los comentarios que piden el tema: es un termómetro gratis.",
    ],
  },
  {
    artist: "Blessd",
    release: "Carrera desde Medellín",
    what: "Construyó una identidad muy clara alrededor de su apodo y de su ciudad, con mucha cercanía con su comunidad y colaboraciones constantes con la escena.",
    lesson: "Una identidad local fuerte viaja. Las colaboraciones con la escena propia amplían el público sin diluir la marca.",
    apply: [
      "Darle peso al origen del artista en el storytelling.",
      "Planear una colaboración por trimestre con alguien de la escena.",
      "Responder comentarios en la primera hora: la comunidad se nota.",
    ],
  },
];
