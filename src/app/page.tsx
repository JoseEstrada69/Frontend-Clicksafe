'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage, getAccessToken, logout } from '@/lib/api';

type Contact = { id?: string; name?: string; email?: string; phone?: string };

export default function HomePage() {  
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading ] =useState(true);
  const [newContact, setNewContact]=useState<Contact>({

  })
  async function createContact(){
    setContacts((prevContacts) => [...(prevContacts ?? []), newContact]);
    await api.post('/contacts',newContact)
      .then(()=>{
      })
      .catch((e)=>setError(errorMessage(e)));
  }

  async function loadContacts(){
    setLoading(true);
    await api
      .get<Contact[]>('/contacts')
      .then(({ data }) => setContacts(data))
      .catch((e) => setError(errorMessage(e)));
    setLoading(false);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    (async () => {
        loadContacts(); 
    }
    )();
  }, [router]);

  return (
    <main>
      <header>
        <h1>Mis contactos</h1>
        <button type="button" onClick={logout}>
          Cerrar sesión
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {loading && <p>Cargando…</p>}
      {contacts?.length === 0 && <p>Todavía no tienes contactos.</p>}
      <ul>
        {contacts?.map((contact) => (
          <li key={contact.id}>
            <strong>{contact.name}</strong>
            <span>{contact.email}</span>
            <span>{contact.phone}</span>
          </li>
        ))}
      </ul>
      <form>
        <p>Nombre:</p>
        <input onChange={(e)=>{
          setNewContact((prevContact)=>({
            ...prevContact,
            name:e.target.value
          }))
        }}

          type="text"></input>
        <p>Email:</p>
        <input onChange={(e)=>{
          setNewContact((prevContact)=>({
            ...prevContact,
            email:e.target.value
          }))
        }}

          type="text"></input>
        <p>Phone:</p>
        <input onChange={(e)=>{
          setNewContact((prevContact)=>({
            ...prevContact,
            phone:e.target.value
          }))
        }}

          type="text"></input>        
          <button onClick={(e)=>{
            e.preventDefault();
            createContact();
          }}>Crear contacto</button>
      </form>
    </main>
  );
}
