import type { Language } from './language';

/**
 * Textos legales de APUNTOR: términos, privacidad y suscripción, en español e inglés.
 *
 * Fuente de verdad de lo que ve el usuario; `docs/legal/*.md` reproduce este mismo texto con notas
 * para la revisión legal. Los corchetes (`Juan Jhan Franco Monja Sanchez`, `10762140859`…) son datos que el titular
 * debe completar: mientras quede alguno, la pantalla muestra el aviso de borrador.
 *
 * Cambiar el contenido obliga a subir `LEGAL_VERSION` (fecha ISO) y `LEGAL_UPDATED`: la
 * aceptación registrada guarda documento, versión y fecha.
 */
export const LEGAL_VERSION = '2026-11-08';

/** Fecha de la última actualización, legible en cada idioma. */
export const LEGAL_UPDATED: Readonly<Record<Language, string>> = {
  es: '8 de noviembre de 2026',
  en: 'November 8, 2026',
};

export type LegalDoc = 'terms' | 'privacy' | 'subscription';

export interface LegalSection {
  title: string;
  paragraphs: readonly string[];
}

export type LegalTexts = Readonly<Record<LegalDoc, readonly LegalSection[]>>;

/** Etiquetas de la cabecera de cada documento legal. */
export const LEGAL_LABELS: Readonly<Record<Language, { version: string; updated: string }>> = {
  es: { version: 'Versión', updated: 'Última actualización' },
  en: { version: 'Version', updated: 'Last updated' },
};

/** `true` si el texto aún tiene datos por completar entre corchetes. */
export function hasPlaceholders(sections: readonly LegalSection[]): boolean {
  return sections.some((s) => s.title.includes('[') || s.paragraphs.some((p) => p.includes('[')));
}

const es: LegalTexts = {
  terms: [
    {
      title: '1. Quién presta el servicio',
      paragraphs: [
        'APUNTOR es una aplicación de estudio para web y celular que presta Juan Jhan Franco Monja Sanchez, persona natural, con RUC 10762140859 y domicilio en Asoc. Unión del Paraíso, San Antonio de Jicamarca Anexo 21, Mz. C1, Lote 05, distrito de San Juan de Lurigancho, provincia y departamento de Lima, Perú ("APUNTOR", "nosotros").',
        'Para cualquier consulta sobre estos términos puedes escribirnos a soporte@apuntor.com.',
      ],
    },
    {
      title: '2. Aceptación y versión',
      paragraphs: [
        'Al crear tu cuenta aceptas estos Términos y condiciones y declaras haber leído la Política de privacidad. Guardamos un registro de tu aceptación con el nombre del documento, su versión y la fecha.',
        'Esta es la versión 2026-11-08, actualizada el 8 de noviembre de 2026. Si no estás de acuerdo con estos términos, no uses APUNTOR.',
      ],
    },
    {
      title: '3. Edad mínima',
      paragraphs: [
        'APUNTOR es solo para personas de 18 años o más. Al registrarte confirmas que eres mayor de edad. No guardamos tu fecha de nacimiento, solo esa confirmación.',
        'Si nos enteramos de que una cuenta pertenece a una persona menor de 18 años, la cerraremos y borraremos sus datos.',
      ],
    },
    {
      title: '4. Tu cuenta',
      paragraphs: [
        'Creas tu cuenta con tu correo y una contraseña y, cuando esté disponible, con tu cuenta de Google. Debes dar datos verdaderos y mantener tu contraseña en reserva.',
        'Eres responsable de lo que se haga con tu cuenta. Si crees que alguien entró sin tu permiso, cambia tu contraseña y escríbenos.',
        'Puedes borrar tu cuenta cuando quieras desde Perfil. El borrado es inmediato y definitivo: elimina tus archivos, tus datos y la cuenta.',
      ],
    },
    {
      title: '5. Qué hace APUNTOR',
      paragraphs: [
        'Subes tus documentos (PDF, Word, PowerPoint, texto o fotos de tus apuntes) y APUNTOR los procesa para que puedas organizarlos, hacer preguntas y estudiar con ellos.',
        'Las respuestas se basan en los documentos que subiste y citan la página de donde sale cada afirmación. Si la respuesta no está en tus documentos, APUNTOR te lo dice en vez de inventarla.',
      ],
    },
    {
      title: '6. Uso de inteligencia artificial y sus límites',
      paragraphs: [
        'APUNTOR usa servicios de inteligencia artificial de Google para leer el texto de tus documentos (incluido el reconocimiento de texto en fotos), crear representaciones numéricas que permiten buscar en ellos y generar respuestas.',
        'Las respuestas las genera una inteligencia artificial y pueden contener errores u omisiones, aun cuando citen una página. Revisa siempre la cita en tu documento antes de confiar en una respuesta.',
        'APUNTOR es una herramienta de apoyo al estudio. No reemplaza a tus profesores, a tus materiales oficiales ni a una asesoría profesional (médica, legal, financiera u otra), y no garantiza resultados académicos.',
      ],
    },
    {
      title: '7. Búsqueda fuera de tus documentos',
      paragraphs: [
        'Si usas "Buscar fuera", el texto de tu pregunta se envía a Tavily, un buscador externo, y el resultado se muestra aparte, en otro color y con su fuente, para que nunca se confunda con tus apuntes.',
        'No controlamos el contenido de sitios de terceros ni respondemos por su exactitud. Puedes apagar esta función en Perfil.',
      ],
    },
    {
      title: '8. Tu material: propiedad y responsabilidad',
      paragraphs: [
        'Los documentos que subes siguen siendo tuyos o de sus titulares. APUNTOR no adquiere ningún derecho de propiedad sobre ellos.',
        'Solo subas material que te pertenezca o que tengas derecho a usar de esta forma. Eres el único responsable de contar con los permisos necesarios, incluidos los derechos de autor de libros, separatas, diapositivas u otros materiales de terceros.',
        'Evita subir documentos con datos personales de otras personas o con datos sensibles (por ejemplo, de salud). Si lo haces, eres responsable de tener una base legal para ello.',
        'Nos das permiso, limitado y sin costo, para guardar, copiar y procesar tu material solo con el fin de prestarte el servicio mientras tengas tu cuenta. Ese permiso termina cuando borras el documento o tu cuenta. No usamos tu material para entrenar modelos de inteligencia artificial.',
      ],
    },
    {
      title: '9. Uso aceptable',
      paragraphs: [
        'No uses APUNTOR para: subir contenido ilegal o que infrinja derechos de terceros; intentar entrar a cuentas o datos ajenos; alterar, saturar o probar la seguridad del servicio sin autorización; extraer datos de forma automatizada; ni engañar a la inteligencia artificial para que ignore sus reglas.',
        'Si incumples estos términos podemos suspender o cerrar tu cuenta. Salvo urgencia o mandato legal, te avisaremos antes y te diremos el motivo.',
      ],
    },
    {
      title: '10. Disponibilidad, límites de uso y cambios del servicio',
      paragraphs: [
        'Hacemos lo posible para que APUNTOR funcione sin interrupciones, pero puede haber fallas, mantenimientos o funciones que cambien o se retiren.',
        'El uso gratuito tiene límites (por ejemplo, espacio de almacenamiento y número de preguntas por día) que se muestran en la app y pueden cambiar con aviso previo.',
        'Hoy APUNTOR no cobra nada. Los pagos se regirán por los Términos de suscripción.',
      ],
    },
    {
      title: '11. Propiedad de APUNTOR',
      paragraphs: [
        'La app, su diseño, la marca APUNTOR, la mascota Illari y el software son de Juan Jhan Franco Monja Sanchez o de sus licenciantes. Estos términos no te dan derechos sobre ellos más allá de usar la app.',
      ],
    },
    {
      title: '12. Responsabilidad',
      paragraphs: [
        'Prestamos el servicio con diligencia, pero no respondemos por decisiones que tomes solo con base en una respuesta generada por la inteligencia artificial, por contenido de terceros mostrado en "Buscar fuera" ni por el material que tú subas.',
        'Nada de lo dicho en estos términos limita los derechos que te reconocen la ley peruana de protección al consumidor ni la Ley N.° 29733, Ley de Protección de Datos Personales.',
      ],
    },
    {
      title: '13. Cambios en estos términos',
      paragraphs: [
        'Podemos actualizar estos términos. Cada versión lleva un número y su fecha. Si el cambio es importante, te avisaremos en la app o por correo y te pediremos aceptarlo de nuevo antes de seguir usando APUNTOR.',
      ],
    },
    {
      title: '14. Ley aplicable y reclamos',
      paragraphs: [
        'Estos términos se rigen por las leyes de la República del Perú.',
        'Si tienes un reclamo, escríbenos a soporte@apuntor.com. También puedes acudir a las autoridades competentes, como el Indecopi en materia de consumo o la Autoridad Nacional de Protección de Datos Personales en lo relativo a tus datos.',
      ],
    },
  ],
  privacy: [
    {
      title: '1. Responsable del tratamiento',
      paragraphs: [
        'El responsable de tus datos personales es Juan Jhan Franco Monja Sanchez, persona natural, con RUC 10762140859 y domicilio en Asoc. Unión del Paraíso, San Antonio de Jicamarca Anexo 21, Mz. C1, Lote 05, distrito de San Juan de Lurigancho, provincia y departamento de Lima, Perú, titular del banco de datos de usuarios de APUNTOR.',
        'Para cualquier asunto sobre tus datos escríbenos a soporte@apuntor.com.',
        'Esta política cumple con el deber de informarte que establece el artículo 18 de la Ley N.° 29733, Ley de Protección de Datos Personales.',
      ],
    },
    {
      title: '2. Qué datos tratamos',
      paragraphs: [
        'Datos de tu cuenta: correo electrónico, contraseña (que guardamos protegida, nunca en texto legible), identificador interno, fecha de creación y tu confirmación de que eres mayor de 18 años. No guardamos tu fecha de nacimiento. Si entras con Google, recibimos tu correo y, si Google lo comparte, tu nombre.',
        'Tu contenido: los documentos que subes, el texto que extraemos de ellos, los fragmentos y representaciones numéricas que permiten buscar en ellos, los temas que detectamos y los cursos que creas.',
        'Tus preguntas: el texto de cada pregunta se procesa en nuestros servidores para generar la respuesta. Hoy el historial de conversaciones se guarda solo en tu dispositivo.',
        'Datos de uso: cuánto espacio y cuántas preguntas usas, para aplicar los límites de tu plan; y el registro de tu aceptación de los términos y de esta política (documento, versión y fecha).',
        'Datos técnicos: la información que todo servicio en internet recibe al conectarte (como la dirección IP y el tipo de dispositivo), usada para que la app funcione y sea segura.',
      ],
    },
    {
      title: '3. Para qué los usamos',
      paragraphs: [
        'Para crear y mantener tu cuenta; guardar y procesar tus documentos; responder tus preguntas con citas de página; aplicar los límites de uso; hacer "Buscar fuera" cuando lo pidas; proteger el servicio contra abusos; atender tus solicitudes.',
        'No vendemos tus datos, no los usamos para publicidad y no usamos tus documentos ni tus preguntas para entrenar modelos de inteligencia artificial. No tomamos decisiones con efectos jurídicos sobre ti basadas solo en un tratamiento automatizado.',
      ],
    },
    {
      title: '4. Base del tratamiento y consentimiento',
      paragraphs: [
        'Tratamos tus datos con tu consentimiento previo, informado, expreso e inequívoco, que nos das al crear tu cuenta y aceptar esta política (artículos 5 y 13.5 de la Ley N.° 29733). Parte del tratamiento es además necesaria para prestarte el servicio que pediste (artículo 14, numeral 5).',
        '"Buscar fuera" es opcional: puedes apagarlo en Perfil cuando quieras.',
        'Puedes revocar tu consentimiento en cualquier momento (artículo 13.7). Como sin estos datos no podemos prestarte el servicio, la forma de revocarlo por completo es borrar tu cuenta.',
      ],
    },
    {
      title: '5. Proveedores que nos ayudan (encargados)',
      paragraphs: [
        'Supabase: cuentas, inicio de sesión y base de datos (servidores en EE. UU., región us-west-2).',
        'Cloudflare: almacenamiento de los archivos que subes (servicio R2).',
        'Google: servicios de inteligencia artificial (API de Gemini o Vertex AI) que extraen el texto de tus documentos, crean las representaciones para buscar en ellos y generan las respuestas.',
        'Tavily: buscador externo que recibe el texto de tu pregunta solo cuando usas "Buscar fuera".',
        'Railway: servidores donde funcionan nuestra API y el procesamiento de documentos.',
        'Estos proveedores tratan tus datos por encargo nuestro, solo para prestarnos su servicio y con medidas de seguridad, conforme al artículo 30 de la Ley N.° 29733.',
      ],
    },
    {
      title: '6. Transferencias internacionales',
      paragraphs: [
        'Los proveedores anteriores son empresas de Estados Unidos y tratan tus datos en servidores ubicados en ese país u otros donde operan. Esto es un flujo transfronterizo de datos personales.',
        'Lo hacemos porque es necesario para prestarte el servicio que pediste y con tu consentimiento (artículo 15, numerales 4 y 7, de la Ley N.° 29733), y exigimos a cada proveedor un nivel de protección adecuado.',
      ],
    },
    {
      title: '7. Cuánto tiempo los conservamos',
      paragraphs: [
        'Tus documentos y su contenido procesado se conservan hasta que los borras o borras tu cuenta.',
        'Si borras tu cuenta desde Perfil, eliminamos de inmediato tus archivos, tus datos y la cuenta. Las conversaciones guardadas en tu dispositivo se borran de ese dispositivo al borrar tu cuenta o al desinstalar la app; si solo cierras sesión, permanecen en él.',
        'Las copias de respaldo técnicas de nuestros proveedores pueden conservar tus datos hasta 30 días después del borrado, hasta que se reemplazan; no las usamos para nada más. Fuera de eso, solo conservaremos algún dato más tiempo si una ley nos obliga a hacerlo, y únicamente por el plazo que esa ley indique.',
      ],
    },
    {
      title: '8. Seguridad',
      paragraphs: [
        'Aplicamos medidas técnicas, organizativas y legales para proteger tus datos (artículo 16 de la Ley N.° 29733): conexiones cifradas, contraseñas protegidas, aislamiento para que solo tu cuenta acceda a tus documentos, enlaces temporales para tus archivos y credenciales de los proveedores guardadas solo en nuestros servidores.',
        'Para darte soporte y mantener el servicio seguro, el responsable puede ver metadatos de las cuentas y de los documentos (correo, fechas de alta y de último ingreso, nombres de archivo, tamaños, estados del procesamiento y conteos de uso), sin ver nunca el contenido de tus documentos ni tus preguntas.',
        'Quienes intervienen en el tratamiento guardan confidencialidad sobre tus datos (artículo 17). Ningún sistema es infalible: si ocurre un incidente que te afecte, te lo comunicaremos y actuaremos según la ley.',
      ],
    },
    {
      title: '9. Tus derechos (ARCO y otros)',
      paragraphs: [
        'Tienes derecho de Acceso a tus datos, de Rectificación (actualización e inclusión), de Cancelación (supresión) y de Oposición: los derechos ARCO (artículos 19, 20 y 22 de la Ley N.° 29733). También tienes derecho a ser informado (artículo 18), a impedir que tus datos se suministren a terceros (artículo 21), a un tratamiento objetivo (artículo 23) y a revocar tu consentimiento.',
        'Desde Perfil puedes descargar tus datos y borrar tu cuenta tú mismo, en cualquier momento.',
        'Para ejercer cualquier otro derecho, escríbenos a soporte@apuntor.com desde el correo de tu cuenta, indicando qué derecho quieres ejercer. Podemos pedirte datos para confirmar tu identidad. Responderemos dentro de los plazos que fija el reglamento de la ley.',
      ],
    },
    {
      title: '10. Reclamos ante la autoridad',
      paragraphs: [
        'Si consideras que no atendimos tu solicitud o que tratamos tus datos de forma indebida, puedes presentar una reclamación ante la Autoridad Nacional de Protección de Datos Personales del Ministerio de Justicia y Derechos Humanos (artículo 24 de la Ley N.° 29733), sin perjuicio de acudir al Poder Judicial.',
      ],
    },
    {
      title: '11. Edad mínima',
      paragraphs: [
        'APUNTOR es solo para mayores de 18 años y no recopila a sabiendas datos de menores de edad. Si detectamos una cuenta de un menor, la cerraremos y borraremos sus datos.',
      ],
    },
    {
      title: '12. Cambios en esta política',
      paragraphs: [
        'Esta es la versión 2026-11-08, actualizada el 8 de noviembre de 2026. Si la cambiamos, publicaremos la nueva versión con su fecha y, si el cambio es importante, te avisaremos y te pediremos aceptarla de nuevo. Guardamos el registro de cada aceptación.',
      ],
    },
  ],
  subscription: [
    {
      title: '1. Hoy APUNTOR es gratis',
      paragraphs: [
        'Por ahora no hay planes de pago: no te pedimos tarjeta ni hacemos cobros de ningún tipo.',
        'El uso gratuito tiene límites de espacio y de preguntas por día, que ves en la app y que pueden cambiar con aviso previo.',
      ],
    },
    {
      title: '2. Cuando lleguen los planes de pago',
      paragraphs: [
        'Antes de cobrarte, publicaremos términos de suscripción completos con el precio, la forma de pago, la renovación, la cancelación y los reembolsos, y te pediremos aceptarlos expresamente.',
        'Nunca te pasaremos a un plan de pago sin tu aceptación expresa.',
      ],
    },
    {
      title: '3. Contacto',
      paragraphs: [
        'Si tienes dudas sobre los planes, escríbenos a soporte@apuntor.com. Esta es la versión 2026-11-08, actualizada el 8 de noviembre de 2026.',
      ],
    },
  ],
};

const en: LegalTexts = {
  terms: [
    {
      title: '1. Who provides the service',
      paragraphs: [
        'APUNTOR is a study app for web and mobile provided by Juan Jhan Franco Monja Sanchez, an individual, RUC (Peruvian tax ID) 10762140859, with its address at Asoc. Unión del Paraíso, San Antonio de Jicamarca Anexo 21, Block C1, Lot 05, San Juan de Lurigancho district, Lima, Peru ("APUNTOR", "we").',
        'For any question about these terms, write to us at soporte@apuntor.com.',
      ],
    },
    {
      title: '2. Acceptance and version',
      paragraphs: [
        'By creating your account you accept these Terms and Conditions and confirm you have read the Privacy Policy. We keep a record of your acceptance with the document name, its version and the date.',
        'This is version 2026-11-08, last updated on November 8, 2026. If you do not agree with these terms, do not use APUNTOR. The Spanish version prevails over this translation.',
      ],
    },
    {
      title: '3. Minimum age',
      paragraphs: [
        'APUNTOR is only for people aged 18 or older. When you sign up you confirm that you are of legal age. We do not store your date of birth, only that confirmation.',
        'If we learn that an account belongs to someone under 18, we will close it and delete its data.',
      ],
    },
    {
      title: '4. Your account',
      paragraphs: [
        'You create your account with your email and a password and, when available, with your Google account. You must provide true information and keep your password private.',
        'You are responsible for what is done with your account. If you think someone accessed it without your permission, change your password and write to us.',
        'You can delete your account at any time from Profile. Deletion is immediate and permanent: it removes your files, your data and the account.',
      ],
    },
    {
      title: '5. What APUNTOR does',
      paragraphs: [
        'You upload your documents (PDF, Word, PowerPoint, text or photos of your notes) and APUNTOR processes them so you can organize them, ask questions and study with them.',
        'Answers are based on the documents you uploaded and cite the page each statement comes from. If the answer is not in your documents, APUNTOR tells you instead of making it up.',
      ],
    },
    {
      title: '6. Use of artificial intelligence and its limits',
      paragraphs: [
        "APUNTOR uses Google's artificial intelligence services to read the text in your documents (including text recognition in photos), create numerical representations that make them searchable, and generate answers.",
        'Answers are generated by artificial intelligence and may contain errors or omissions, even when they cite a page. Always check the citation in your document before relying on an answer.',
        'APUNTOR is a study aid. It does not replace your teachers, your official materials or professional advice (medical, legal, financial or other), and it does not guarantee academic results.',
      ],
    },
    {
      title: '7. Searching outside your documents',
      paragraphs: [
        'If you use "Search outside", the text of your question is sent to Tavily, an external search engine, and the result is shown separately, in a different color and with its source, so it is never confused with your notes.',
        'We do not control the content of third-party sites and are not responsible for its accuracy. You can turn this feature off in Profile.',
      ],
    },
    {
      title: '8. Your material: ownership and responsibility',
      paragraphs: [
        "The documents you upload remain yours or their owners'. APUNTOR acquires no ownership rights over them.",
        'Only upload material that belongs to you or that you have the right to use in this way. You alone are responsible for having the necessary permissions, including the copyright of books, handouts, slides or other third-party materials.',
        "Avoid uploading documents with other people's personal data or with sensitive data (for example, health data). If you do, you are responsible for having a legal basis to do so.",
        'You give us a limited, free permission to store, copy and process your material only to provide you with the service while you have your account. That permission ends when you delete the document or your account. We do not use your material to train artificial intelligence models.',
      ],
    },
    {
      title: '9. Acceptable use',
      paragraphs: [
        "Do not use APUNTOR to: upload illegal content or content that infringes third-party rights; try to access other people's accounts or data; disrupt, overload or test the security of the service without authorization; scrape data automatically; or trick the artificial intelligence into ignoring its rules.",
        'If you breach these terms we may suspend or close your account. Except in urgent cases or when required by law, we will notify you first and tell you why.',
      ],
    },
    {
      title: '10. Availability, usage limits and changes to the service',
      paragraphs: [
        'We do our best to keep APUNTOR running without interruptions, but there may be failures, maintenance, or features that change or are removed.',
        'Free use has limits (for example, storage space and number of questions per day) that are shown in the app and may change with prior notice.',
        'Today APUNTOR charges nothing. Payments will be governed by the Subscription Terms.',
      ],
    },
    {
      title: '11. APUNTOR property',
      paragraphs: [
        'The app, its design, the APUNTOR brand, the Illari mascot and the software belong to Juan Jhan Franco Monja Sanchez or its licensors. These terms give you no rights over them beyond using the app.',
      ],
    },
    {
      title: '12. Liability',
      paragraphs: [
        'We provide the service with due care, but we are not responsible for decisions you make based solely on an answer generated by artificial intelligence, for third-party content shown in "Search outside", or for the material you upload.',
        'Nothing in these terms limits the rights granted to you by Peruvian consumer protection law or by Law No. 29733, the Personal Data Protection Law.',
      ],
    },
    {
      title: '13. Changes to these terms',
      paragraphs: [
        'We may update these terms. Each version has a number and a date. If the change is significant, we will notify you in the app or by email and ask you to accept it again before you keep using APUNTOR.',
      ],
    },
    {
      title: '14. Governing law and complaints',
      paragraphs: [
        'These terms are governed by the laws of the Republic of Peru.',
        'If you have a complaint, write to us at soporte@apuntor.com. You may also go to the competent authorities, such as Indecopi for consumer matters or the National Personal Data Protection Authority for matters concerning your data.',
      ],
    },
  ],
  privacy: [
    {
      title: '1. Data controller',
      paragraphs: [
        'The controller of your personal data is Juan Jhan Franco Monja Sanchez, an individual, RUC 10762140859, with its address at Asoc. Unión del Paraíso, San Antonio de Jicamarca Anexo 21, Block C1, Lot 05, San Juan de Lurigancho district, Lima, Peru, owner of the APUNTOR user database.',
        'For any matter about your data, write to us at soporte@apuntor.com.',
        'This policy fulfills the duty to inform you set out in article 18 of Law No. 29733, the Personal Data Protection Law of Peru. The Spanish version prevails over this translation.',
      ],
    },
    {
      title: '2. What data we process',
      paragraphs: [
        'Account data: email address, password (stored protected, never in readable form), internal identifier, creation date and your confirmation that you are 18 or older. We do not store your date of birth. If you sign in with Google, we receive your email and, if Google shares it, your name.',
        'Your content: the documents you upload, the text we extract from them, the fragments and numerical representations that make them searchable, the topics we detect and the courses you create.',
        'Your questions: the text of each question is processed on our servers to generate the answer. Today your conversation history is stored only on your device.',
        'Usage data: how much storage and how many questions you use, to apply your plan limits; and the record of your acceptance of the terms and this policy (document, version and date).',
        'Technical data: the information any internet service receives when you connect (such as your IP address and device type), used to make the app work and keep it secure.',
      ],
    },
    {
      title: '3. What we use it for',
      paragraphs: [
        'To create and maintain your account; store and process your documents; answer your questions with page citations; apply usage limits; run "Search outside" when you ask for it; protect the service from abuse; handle your requests.',
        'We do not sell your data, we do not use it for advertising, and we do not use your documents or questions to train artificial intelligence models. We do not make decisions with legal effects on you based solely on automated processing.',
      ],
    },
    {
      title: '4. Legal basis and consent',
      paragraphs: [
        'We process your data with your prior, informed, express and unequivocal consent, which you give when you create your account and accept this policy (articles 5 and 13.5 of Law No. 29733). Part of the processing is also necessary to provide the service you requested (article 14, item 5).',
        '"Search outside" is optional: you can turn it off in Profile at any time.',
        'You can withdraw your consent at any time (article 13.7). Since we cannot provide the service without this data, the way to withdraw it completely is to delete your account.',
      ],
    },
    {
      title: '5. Providers that help us (processors)',
      paragraphs: [
        'Supabase: accounts, sign-in and database (servers in the US, us-west-2 region).',
        'Cloudflare: storage of the files you upload (R2 service).',
        'Google: artificial intelligence services (Gemini API or Vertex AI) that extract the text from your documents, create the representations used to search them, and generate answers.',
        'Tavily: external search engine that receives the text of your question only when you use "Search outside".',
        'Railway: servers that run our API and document processing.',
        'These providers process your data on our behalf, only to provide their service to us and with security measures, in accordance with article 30 of Law No. 29733.',
      ],
    },
    {
      title: '6. International transfers',
      paragraphs: [
        'The providers above are United States companies and process your data on servers located in that country or others where they operate. This is a cross-border flow of personal data.',
        'We do this because it is necessary to provide the service you requested and with your consent (article 15, items 4 and 7, of Law No. 29733), and we require each provider to ensure an adequate level of protection.',
      ],
    },
    {
      title: '7. How long we keep it',
      paragraphs: [
        'Your documents and their processed content are kept until you delete them or delete your account.',
        'If you delete your account from Profile, we immediately delete your files, your data and the account. Conversations stored on your device are removed from it when you delete your account or uninstall the app; if you only sign out, they remain on it.',
        "Our providers' technical backups may keep your data for up to 30 days after deletion, until they are replaced; we don't use them for anything else. Beyond that, we will keep any data longer only if a law requires us to, and only for the period that law sets.",
      ],
    },
    {
      title: '8. Security',
      paragraphs: [
        'We apply technical, organizational and legal measures to protect your data (article 16 of Law No. 29733): encrypted connections, protected passwords, isolation so that only your account can access your documents, temporary links for your files, and provider credentials kept only on our servers.',
        'To support you and keep the service secure, the data controller can see metadata about accounts and documents (email, sign-up and last sign-in dates, file names, sizes, processing status and usage counts), without ever seeing the content of your documents or your questions.',
        'Everyone involved in the processing keeps your data confidential (article 17). No system is infallible: if an incident affects you, we will let you know and act as the law requires.',
      ],
    },
    {
      title: '9. Your rights (ARCO and others)',
      paragraphs: [
        'You have the right of Access to your data, Rectification (updating and inclusion), Cancellation (erasure) and Objection: the ARCO rights (articles 19, 20 and 22 of Law No. 29733). You also have the right to be informed (article 18), to prevent your data from being supplied to third parties (article 21), to objective processing (article 23) and to withdraw your consent.',
        'From Profile you can download your data and delete your account yourself, at any time.',
        'To exercise any other right, write to soporte@apuntor.com from your account email, stating which right you want to exercise. We may ask for information to confirm your identity. We will reply within the time limits set by the regulations of the law.',
      ],
    },
    {
      title: '10. Complaints to the authority',
      paragraphs: [
        'If you believe we did not handle your request or that we processed your data improperly, you can file a complaint with the National Personal Data Protection Authority of the Ministry of Justice and Human Rights (article 24 of Law No. 29733), without prejudice to going to the courts.',
      ],
    },
    {
      title: '11. Minimum age',
      paragraphs: [
        'APUNTOR is only for people aged 18 or older and does not knowingly collect data from minors. If we detect an account belonging to a minor, we will close it and delete its data.',
      ],
    },
    {
      title: '12. Changes to this policy',
      paragraphs: [
        'This is version 2026-11-08, last updated on November 8, 2026. If we change it, we will publish the new version with its date and, if the change is significant, we will notify you and ask you to accept it again. We keep a record of each acceptance.',
      ],
    },
  ],
  subscription: [
    {
      title: '1. APUNTOR is free today',
      paragraphs: [
        'There are no paid plans for now: we do not ask for a card and we do not charge anything.',
        'Free use has storage and daily question limits, which you can see in the app and which may change with prior notice.',
      ],
    },
    {
      title: '2. When paid plans arrive',
      paragraphs: [
        'Before charging you, we will publish full subscription terms with the price, payment method, renewal, cancellation and refunds, and ask you to accept them expressly.',
        'We will never move you to a paid plan without your express acceptance.',
      ],
    },
    {
      title: '3. Contact',
      paragraphs: [
        'If you have questions about plans, write to us at soporte@apuntor.com. This is version 2026-11-08, last updated on November 8, 2026.',
      ],
    },
  ],
};

/** Textos legales por idioma. */
export const LEGAL: Readonly<Record<Language, LegalTexts>> = { es, en };
