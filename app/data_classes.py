from abc import ABC, abstractmethod
import datetime
from typing import List, Dict, Any
from info_tools import InfoTools


class Active:
    IT: InfoTools = InfoTools()
    def __init__(self, isin: str, name: str):

        # -- 1: Almaceno parametros en propiedades
        self.isin: str = isin
        self.name: str = name

        # -- 2: Defino propiedades que voy a ir utilizando dinamicamente
        self.current_qty: float = 0.0
        self.total_net_proffit: float = 0.0
        self.total_gross_proffit: float = 0.0
        self.total_comissions: float = 0.0
        self.total_taxes: float = 0.0

        # -- 3: Defino la lista que va a contener las operaciones del activo
        self.operations_list: List[Operation] = []

        # -- 4: Defino la lista donde se van a almacenar las operaciones cerradas
        self.closed_operations_list: List[Operation] = []

        # -- 5: Defino la lista donde se van a almacenar las operaciones que aun quedan
        self.opened_operations_list: List[Operation] = []

        # -- 6: Lista para almacenar el detalle de cada venta (lotes cerrados)
        self.sales_details: List[Dict[str, Any]] = []

    def add_operation(self, isin: str, str_date: str, description: str, qty: float, amount: float):
        """
        Metodo que valida que tipo de operacion se ha realizado y la agrega
        :param isin:
        :param str_date:
        :param description:
        :param qty:
        :param amount:
        :return:
        """

        # ---- 1.1: Valido si es venta
        if description.startswith("Sell"):
            self.operations_list.append(SellOperation(isin, str_date, description, qty, amount))
            self.current_qty -= qty

        # ---- 1.2: Valido si es compra
        else:
            self.operations_list.append(BuyOperation(isin, str_date, description, qty, amount))
            self.current_qty += qty

    def calculate_fifo(self):
        """
        Metodo que itera sobre la lista de operaciones y realiza el calculo FIFO
        """
        # Reiniciamos contadores
        self.total_net_proffit = 0.0
        self.total_gross_proffit = 0.0
        self.total_comissions = 0.0
        self.total_taxes = 0.0
        
        self.opened_operations_list = []
        self.closed_operations_list = []
        self.sales_details = []

        # Cola FIFO para las compras disponibles: lista de diccionarios {'op': BuyOperation, 'remaining_qty': float}
        fifo_queue = []

        for operation in self.operations_list:
            if isinstance(operation, BuyOperation):
                # Agregamos a la cola
                fifo_queue.append({'op': operation, 'remaining_qty': operation.qty})
                
                # Sumamos comision
                self.total_comissions += operation.comissions
                
            elif isinstance(operation, SellOperation):
                qty_to_sell = operation.qty
                
                # Paso 1: Identificar lotes y coste total de compra para esta venta
                matched_entries = [] 
                total_buy_cost = 0.0
                
                # Usamos una variable temporal para no modificar la cola hasta estar seguros, 
                # aunque en este caso vamos consumiendo directamente porque es FIFO estricto.
                
                while qty_to_sell > 0 and fifo_queue:
                    buy_entry = fifo_queue[0]
                    available_qty = buy_entry['remaining_qty']
                    
                    # Cantidad a casar
                    matched_qty = min(qty_to_sell, available_qty)
                    
                    # Guardamos referencia para luego calcular beneficios individuales
                    matched_entries.append({
                        'buy_op': buy_entry['op'],
                        'matched_qty': matched_qty,
                        'buy_price': buy_entry['op'].buy_price
                    })
                    
                    # Acumulamos el coste de compra
                    total_buy_cost += matched_qty * buy_entry['op'].buy_price
                    
                    # Actualizamos cantidades en la cola
                    qty_to_sell -= matched_qty
                    buy_entry['remaining_qty'] -= matched_qty
                    
                    # Si se agota la compra, la sacamos de la cola
                    if buy_entry['remaining_qty'] <= 0.000001:
                        fifo_queue.pop(0)
                
                # Paso 2: Actualizar la operación de venta con los impuestos y precio real calculados
                # basándonos en el coste de compra (para saber la plusvalía)
                operation.update_with_fifo_data(total_buy_cost)
                
                # Agregamos a cerradas y sumamos totales
                self.closed_operations_list.append(operation)
                self.total_comissions += operation.comissions
                self.total_taxes += operation.taxes
                
                # Paso 3: Calcular beneficios y rellenar detalles
                current_sale_gross_profit = 0.0
                
                sale_detail = {
                    'sell_operation': operation,
                    'matched_buys': [],
                    'gross_profit': 0.0,
                    'net_profit': 0.0,
                    'comissions': operation.comissions,
                    'taxes': operation.taxes
                }
                
                for match in matched_entries:
                    buy_op = match['buy_op']
                    matched_qty = match['matched_qty']
                    buy_price = match['buy_price']
                    
                    # Calculamos beneficio bruto de este tramo
                    profit = (operation.sell_price - buy_price) * matched_qty
                    current_sale_gross_profit += profit
                    self.total_gross_proffit += profit
                    
                    sale_detail['matched_buys'].append({
                        'buy_operation': buy_op,
                        'matched_qty': matched_qty,
                        'buy_price': buy_price
                    })
                
                # Calculamos beneficio neto de esta venta
                current_sale_net_profit = current_sale_gross_profit - operation.comissions - operation.taxes
                
                sale_detail['gross_profit'] = current_sale_gross_profit
                sale_detail['net_profit'] = current_sale_net_profit
                
                self.sales_details.append(sale_detail)
        
        # Calculamos beneficio neto total
        self.total_net_proffit = self.total_gross_proffit - self.total_comissions - self.total_taxes
        
        # Rellenamos opened_operations_list con lo que queda en la cola
        for entry in fifo_queue:
            original_op = entry['op']
            remaining_qty = entry['remaining_qty']
            
            # Calculamos el amount equivalente para que el precio de compra se mantenga
            new_amount = original_op.buy_price * remaining_qty
            
            new_op = BuyOperation(
                isin=original_op.isin,
                str_date=original_op.str_date,
                description=original_op.description,
                qty=remaining_qty,
                amount=new_amount
            )
            
            new_op.comissions = 0.0
            new_op.buy_price = original_op.buy_price
            
            self.opened_operations_list.append(new_op)

    def print_fifo_report(self):
        """
        Metodo para imprimir en consola el reporte de las operaciones FIFO
        """
        self.IT.header_print(f"Reporte FIFO para {self.name} ({self.isin})")

        self.IT.intro_print("TOTALES")
        self.IT.info_print(f"Total Gross Profit: {self.total_gross_proffit:.2f}")
        self.IT.info_print(f"Total Net Profit: {self.total_net_proffit:.2f}")
        self.IT.info_print(f"Total Commissions: {self.total_comissions:.2f}")
        self.IT.info_print(f"Total Taxes: {self.total_taxes:.2f}")

        self.IT.intro_print("OPERACIONES CERRADAS (Lotes Casados):")

        for detail in self.sales_details:
            sell_op = detail['sell_operation']
            self.IT.sub_intro_print(f"VENTA: Fecha: {sell_op.str_date},"
                                    f" Qty: {sell_op.qty},"
                                    f" Precio Venta: {sell_op.sell_price:.4f},"
                                    f" Bruto: {detail['gross_profit']:.2f},"
                                    f" Comisiones: {detail['comissions']:.2f},"
                                    f" Impuestos: {detail['taxes']:.2f},"
                                    f" [NETO]: {detail['net_profit']:.2f} €"
                                    )

            for match in detail['matched_buys']:
                buy_op = match['buy_operation']
                matched_qty = match['matched_qty']
                buy_price = match['buy_price']
                self.IT.info_print(f"    - COMPRA: Fecha: {buy_op.str_date}, Qty Casada: {matched_qty:.4f}, Precio Compra: {buy_price:.4f}")

            
        self.IT.intro_print("Operaciones Abiertas (Cartera Actual):")
        for op in self.opened_operations_list:
            self.IT.info_print(f"  - Fecha: {op.str_date}, Qty: {op.qty:.4f}, Precio Compra: {op.buy_price:.4f}")

    def to_dict(self) -> Dict[str, Any]:
        """
        Convierte el objeto Active a un diccionario serializable.
        """
        return {
            "isin": self.isin,
            "name": self.name,
            "current_qty": self.current_qty,
            "total_net_proffit": self.total_net_proffit,
            "total_gross_proffit": self.total_gross_proffit,
            "total_comissions": self.total_comissions,
            "total_taxes": self.total_taxes,
            "operations_list": [op.to_dict() for op in self.operations_list],
            "closed_operations_list": [op.to_dict() for op in self.closed_operations_list],
            "opened_operations_list": [op.to_dict() for op in self.opened_operations_list],
            "sales_details": [
                {
                    "sell_operation": detail["sell_operation"].to_dict(),
                    "gross_profit": detail["gross_profit"],
                    "net_profit": detail["net_profit"],
                    "comissions": detail["comissions"],
                    "taxes": detail["taxes"],
                    "matched_buys": [
                        {
                            "buy_operation": match["buy_operation"].to_dict(),
                            "matched_qty": match["matched_qty"],
                            "buy_price": match["buy_price"]
                        }
                        for match in detail["matched_buys"]
                    ]
                }
                for detail in self.sales_details
            ]
        }


class Operation(ABC):
    def __init__(self, isin: str, str_date: str, description: str, qty: float, amount: float):

        # -- 1: Almaceno parametros en propiedades
        self.isin: str = isin
        self.str_date: str = str_date
        self.datetime: datetime.datetime = datetime.datetime.strptime(self.str_date, "%Y-%m-%d")
        self.description: str = description
        self.qty: float = qty
        self.amount: float = amount

    def to_dict(self) -> Dict[str, Any]:
        """
        Convierte la operación base a un diccionario.
        """
        return {
            "type": self.__class__.__name__,
            "isin": self.isin,
            "str_date": self.str_date,
            "description": self.description,
            "qty": self.qty,
            "amount": self.amount
        }


class BuyOperation(Operation):
    def __init__(self, isin: str, str_date: str, description: str, qty: float, amount: float):
        super().__init__(isin, str_date, description, qty, amount)
        
        # -- 1: Defino y calculo las comisiones
        self.comissions: float = self.calculate_comissions()

        # -- 2: Defino y calculo el precio de compra
        self.buy_price: float = self.calculate_buy_price()
    
    def calculate_buy_price(self) -> float:
        """
        Metodo para calcular el precio de compra exacto en funcion de las comisiones, la cantidad y el importe
        :return: 
        """

        # ----------------------------------------------------------------------------------------------------------
        # -- 1: Obtenemos el precio de compra: (amount - commissions) / qty
        # ----------------------------------------------------------------------------------------------------------
        
        # ---- 1.1: Calculamos el precio de compra
        return (self.amount - self.comissions) / self.qty
    
    def calculate_comissions(self) -> float:
        """
        Metodo para calcular las comisiones en funcion de la descripcion
        :return: 
        """
        # ----------------------------------------------------------------------------------------------------------
        # -- 1: Dependiendo de las palabras clave que vengan en la descripcion, tiene comision o no
        # ----------------------------------------------------------------------------------------------------------
        
        # ---- 1.1: Planes de inversion no tienen comision
        if "Savings" in self.description:
            return 0
        
        # ---- 1.2: El resto de compras tiene 1 € de comision
        else:
            return 1

    def to_dict(self) -> Dict[str, Any]:
        data = super().to_dict()
        data.update({
            "comissions": self.comissions,
            "buy_price": self.buy_price
        })
        return data


class SellOperation(Operation):
    def __init__(self, isin:str, str_date: str, description: str, qty: float, amount: float):
        super().__init__(isin, str_date, description, qty, amount)

        # -- 1: Defino y calculo las comisiones
        self.comissions: float = 1.0
        
        # -- 2: Inicializo impuestos y bruto provisionalmente (se calcularán en FIFO)
        self.taxes: float = 0.0
        self.bruto: float = self.amount + self.comissions
        self.sell_price: float = self.bruto / self.qty

    def should_apply_tax(self) -> bool:
        """
        Determina si se debe aplicar retención basada en el ISIN y la fecha.
        """
        datetime_limit = datetime.datetime.strptime("2025-07-01", "%Y-%m-%d")
        return self.isin.startswith("IE") and self.datetime >= datetime_limit

    def update_with_fifo_data(self, total_buy_cost: float):
        """
        Actualiza los impuestos, el bruto y el precio de venta basándose en el coste de compra real (FIFO).
        Resuelve la ecuación inversa para deducir el precio de venta bruto si hubo retención.
        """
        if self.should_apply_tax():
            # Intentamos calcular asumiendo ganancia y retención del 19%
            # Formula: Incoming = VentaBruta - Comision - (VentaBruta - CosteCompra) * 0.19
            # Despejando VentaBruta:
            # VentaBruta = (Incoming + Comision - 0.19 * CosteCompra) / 0.81
            
            tax_rate = 0.19
            incoming = self.amount
            
            # Venta bruta hipotética asumiendo que hubo retención
            v_hypothetical = (incoming + self.comissions - tax_rate * total_buy_cost) / (1 - tax_rate)
            
            # Verificamos si con esa venta bruta hay ganancia (condición para que haya retención)
            if v_hypothetical > total_buy_cost:
                # Caso con ganancia y retención
                self.bruto = v_hypothetical
                self.taxes = (self.bruto - total_buy_cost) * tax_rate
            else:
                # Caso sin ganancia (o pérdida), no hay retención
                self.bruto = incoming + self.comissions
                self.taxes = 0.0
        else:
            # No aplica retención por fecha/ISIN
            self.bruto = self.amount + self.comissions
            self.taxes = 0.0
            
        # Recalculamos el precio de venta unitario
        self.sell_price = self.bruto / self.qty

    def calculate_comissions(self) -> int:
        """
        Metodo para calcular las comisiones en funcion de la descripcion
        :return: 
        """
        # ----------------------------------------------------------------------------------------------------------
        # -- 1: Dependiendo de las palabras clave que vengan en la descripcion, tiene comision o no
        # ----------------------------------------------------------------------------------------------------------

        # ---- 1.1: Planes de inversion no tienen comision
        if "Savings" in self.description:
            return 0

        # ---- 1.2: El resto de compras tiene 1 € de comision
        else:
            return 1
        
    def to_dict(self) -> Dict[str, Any]:
        data = super().to_dict()
        data.update({
            "comissions": self.comissions,
            "taxes": self.taxes,
            "bruto": self.bruto,
            "sell_price": self.sell_price
        })
        return data
